import { test, expect } from "bun:test";
import { markDemoPdf } from "./pdf-render-context";

test("real PDFs never receive a demonstration overlay", () => {
  let pagesAccessed = 0;
  markDemoPdf({ getNumberOfPages() { pagesAccessed++; return 1; } });
  expect(pagesAccessed).toBe(0);
});

test("demo context marks every page explicitly", () => {
  const pages = [];
  markDemoPdf({
    getNumberOfPages: () => 2,
    setPage: (page) => pages.push(page),
    setFont() {}, setFontSize() {}, setTextColor() {}, text() {},
    internal: { scaleFactor: 1, pageSize: { getWidth: () => 596 } },
  }, { demo: true });
  expect(pages).toEqual([1, 2]);
});