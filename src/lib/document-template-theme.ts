/** Palette shared by the supplied quote, invoice and order templates. */
export const DOCUMENT_TEMPLATE = {
  ink: [15, 23, 42],
  blue: [47, 95, 255],
  muted: [148, 157, 173],
  textSoft: [113, 122, 140],
  line: [228, 231, 238],
  panel: [244, 245, 249],
  blueSoft: [232, 238, 255],
  cyanSoft: [220, 247, 255],
  cyan: [0, 139, 187],
  payment: [232, 238, 255],
} satisfies Record<string, [number, number, number]>;