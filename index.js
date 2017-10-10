// @flow

import * as most from "most";
import { request } from "most-request";
import * as path from "path";
import cheerio from "cheerio";
import download from "download-file";

function byIndex(a: { index: number }, b: { index: number }): number {
  return a.index - b.index;
}

type URL = string;
type ChapterID = number;
type Chapter = { index: ChapterID, title: URL, pages: ?(URL[]) };

const makeChapter = (shortURL: URL): Chapter => ({
  index: parseInt(path.basename(shortURL), 10),
  title: `http://readmanga.me${shortURL}?mtr=1`,
  pages: null
});

function parseChapters(page: string): Chapter[] {
  const $ = cheerio.load(page);
  return $(".chapters-link td a")
    .toArray()
    .map(a => a.attribs.href)
    .map(makeChapter)
    .sort(byIndex);
}

// prettier-ignore
const fetchTitleHTML = (title: string): most.Stream<string> =>
  request({ url: `http://readmanga.me/${title}` })
    .map(response => response.text);

function parsePages(page: string): URL[] {
  const $ = cheerio.load(page);
  const script = $(".pageBlock.reader-bottom.container script").html();
  const pagesUnsafe = script.match(/rm_h\.init\((.*), 0, false\);/)[1];
  const pages = eval(pagesUnsafe).map(([vol, host, page]) => host + vol + page);

  return pages;
}

const fetchPages = (chapter: Chapter): most.Stream<Chapter> =>
  request({ url: chapter.title })
    .map(response => response.text)
    .map(parsePages)
    .map(pages => ({ ...chapter, pages }));

const downloadChapter = (name: string, chapter: Chapter) => {
  console.log(`Downloading chapter #${chapter.index}`);

  const chapterName = chapter.index.toString().padStart(4, "0");
  const directory = path.resolve(__dirname, name, chapterName);

  if (chapter.pages) {
    chapter.pages.forEach((page, pageIndex) => {
      const pageName = pageIndex.toString().padStart(3, "0");
      const filename = pageName + path.extname(page);

      download(page, { directory, filename });
    });
  }
};

const downloadManga = (name: string) =>
  fetchTitleHTML(name)
    .map(parseChapters)
    .chain(chapters => most.from(chapters))
    .concatMap(chapter => fetchPages(chapter).delay(1000))
    .forEach(chapter => downloadChapter(name, chapter));

const name = process.argv[2];

if (name == null) {
  console.error("Usage: readmanga <name>");
} else {
  downloadManga(name);
}
