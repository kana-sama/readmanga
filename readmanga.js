"use strict";

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _most = require("most");

var most = _interopRequireWildcard(_most);

var _mostRequest = require("most-request");

var _path = require("path");

var path = _interopRequireWildcard(_path);

var _cheerio = require("cheerio");

var _cheerio2 = _interopRequireDefault(_cheerio);

var _downloadFile = require("download-file");

var _downloadFile2 = _interopRequireDefault(_downloadFile);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function byIndex(a, b) {
  return a.index - b.index;
}

const makeChapter = shortURL => ({
  index: parseInt(path.basename(shortURL), 10),
  title: `http://readmanga.me${shortURL}?mtr=1`,
  pages: null
});

function parseChapters(page) {
  const $ = _cheerio2.default.load(page);
  return $(".chapters-link td a").toArray().map(a => a.attribs.href).map(makeChapter).sort(byIndex);
}

// prettier-ignore
const fetchTitleHTML = title => (0, _mostRequest.request)({ url: `http://readmanga.me/${title}` }).map(response => response.text);

function parsePages(page) {
  const $ = _cheerio2.default.load(page);
  const script = $(".pageBlock.reader-bottom.container script").html();
  const pagesUnsafe = script.match(/rm_h\.init\((.*), 0, false\);/)[1];
  const pages = eval(pagesUnsafe).map(([vol, host, page]) => host + vol + page);

  return pages;
}

const fetchPages = chapter => (0, _mostRequest.request)({ url: chapter.title }).map(response => response.text).map(parsePages).map(pages => _extends({}, chapter, { pages }));

const downloadChapter = (name, chapter) => {
  console.log(`Downloading chapter #${chapter.index}`);

  const chapterName = chapter.index.toString().padStart(4, "0");
  const directory = path.resolve(__dirname, name, chapterName);

  if (chapter.pages) {
    chapter.pages.forEach((page, pageIndex) => {
      const pageName = pageIndex.toString().padStart(3, "0");
      const filename = pageName + path.extname(page);

      (0, _downloadFile2.default)(page, { directory, filename });
    });
  }
};

const downloadManga = name => fetchTitleHTML(name).map(parseChapters).chain(chapters => most.from(chapters)).concatMap(chapter => fetchPages(chapter).delay(1000)).forEach(chapter => downloadChapter(name, chapter));

const name = process.argv[2];

if (name == null) {
  console.error("Usage: readmanga <name>");
} else {
  downloadManga(name);
}
