const Campground = require("../models/campground");
const mbxGeocoding = require("@mapbox/mapbox-sdk/services/geocoding");
const mapBoxToken = process.env.MAPBOX_TOKEN;
const geocoder = mbxGeocoding({ accessToken: mapBoxToken });
const { cloudinary } = require("../cloudinary");
const { populate } = require("../models/campground");

module.exports.index = async (req, res, next) => {
  // if search
  if (req.query.search) {
    const regex = new RegExp(escapeRegex(req.query.search), "gi");
    const campgrounds = await populateCamp(
      Campground.find({
        $or: [{ title: regex }, { location: regex }],
      })
    );
    if (campgrounds.length < 1) {
      req.flash("error", "No campgrounds found, please try again.");
      res.redirect("back");
    }
    res.render("campgrounds/index", { campgrounds });
    // sorting highest rated
  } else if (req.query.sortby === "higestRated") {
    const campgrounds = await populateCamp(
      Campground.find({}).sort({ rating: -1 })
    );
    res.render("campgrounds/index", { campgrounds });
    //sorting lowest price
  } else if (req.query.sortby === "lowestPrice") {
    const campgrounds = await populateCamp(
      Campground.find({}).sort({ price: 1 })
    );
    res.render("campgrounds/index", { campgrounds });
    //sorting highest price
  } else if (req.query.sortby === "highestPrice") {
    const campgrounds = await populateCamp(
      Campground.find({}).sort({ price: -1 })
    );
    res.render("campgrounds/index", { campgrounds });
    //clear sorting or no query
  } else if (req.query.sortby === "clear" || !req.query.sortby) {
    const campgrounds = await populateCamp(Campground.find({}));
    res.render("campgrounds/index", { campgrounds });
    //find by tag
  } else {
    const campgrounds = await populateCamp(
      Campground.find({
        tag: { $in: [req.query.sortby] },
      })
    );
    res.render("campgrounds/index", { campgrounds });
  }
};

module.exports.renderNewForm = (req, res) => {
  res.render("campgrounds/new");
};

module.exports.createCampground = async (req, res, next) => {
  const geoData = await geocoder
    .forwardGeocode({
      query: req.body.campground.location,
      limit: 1,
    })
    .send();
  const campground = new Campground(req.body.campground);
  campground.geometry = geoData.body.features[0].geometry;
  campground.images = req.files.map((f) => ({
    url: f.path,
    filename: f.filename,
  }));
  campground.author = req.user._id;
  await campground.save();
  req.flash("success", "Succesfully made a new campground!");
  res.redirect(`/campgrounds/${campground._id}`);
};

module.exports.showOnMap = async (req, res, next) => {
  const campgrounds = await Campground.find({});

  res.render("campgrounds/map", { campgrounds });
};

module.exports.showCampground = async (req, res, next) => {
  const campground = await Campground.findById(req.params.id)
    .populate({
      path: "reviews",
      populate: {
        path: "author",
      },
    })
    .populate("author");
  if (!campground) {
    req.flash("error", "No campground found!");
    return res.redirect("/campgrounds");
  }
  res.render("campgrounds/show", { campground });
};

module.exports.renderEditForm = async (req, res, next) => {
  const campground = await Campground.findById(req.params.id);
  if (!campground) {
    req.flash("error", "No campground found!");
    return res.redirect("/campgrounds");
  }
  res.render("campgrounds/edit", { campground });
};

module.exports.updateCampground = async (req, res, next) => {
  const campground = await Campground.findByIdAndUpdate(req.params.id, {
    ...req.body.campground,
  });
  const imgs = req.files.map((f) => ({
    url: f.path,
    filename: f.filename,
  }));
  campground.images.push(...imgs);
  await campground.save();
  if (req.body.deleteImages) {
    for (let filename of req.body.deleteImages) {
      await cloudinary.uploader.destroy(filename);
    }
    await campground.updateOne({
      $pull: { images: { filename: { $in: req.body.deleteImages } } },
    });
  }
  req.flash("success", "Succesfully updated campground!");
  res.redirect(`/campgrounds/${campground._id}`);
};

module.exports.deleteCampground = async (req, res, next) => {
  await Campground.findByIdAndDelete(req.params.id);
  req.flash("success", "Succesfully deleted campground!");
  res.redirect("/campgrounds");
};

function escapeRegex(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

function populateCamp(campground) {
  return campground
    .populate({
      path: "reviews",
      populate: {
        path: "author",
      },
    })
    .populate("author");
}
