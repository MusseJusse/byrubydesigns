export type GalleryCategoryId = "tattoo" | "drawings" | "paintings";

export type GalleryArtwork = {
  fileName: string;
  imagePath: `/src/assets/artwork/${string}.webp`;
  title: string;
  aspectRatio: string;
  year?: 2022 | 2026;
  medium?: string;
  dimensions?: {
    width: number;
    height: number;
    unit: "mm" | "cm";
  };
};

export type GalleryCategory = {
  id: GalleryCategoryId;
  label: string;
  items: readonly GalleryArtwork[];
};

const tattooSource = [
  { fileName: "IMG_6601.webp", title: "Tattoo 13" },
  { fileName: "IMG_3554.webp", title: "Tattoo 12" },
  { fileName: "IMG_3112.webp", title: "Tattoo 11" },
  { fileName: "IMG_2526.webp", title: "Tattoo 10" },
  { fileName: "IMG_2522.webp", title: "Tattoo 09" },
  { fileName: "IMG_2233.webp", title: "Tattoo 08" },
  { fileName: "IMG_1356.webp", title: "Tattoo 07" },
  { fileName: "IMG_1220.webp", title: "Tattoo 06" },
  { fileName: "IMG_1163.webp", title: "Tattoo 05", aspectRatio: "2 / 3" },
  { fileName: "IMG_0545.webp", title: "Tattoo 04", aspectRatio: "1 / 1" },
  { fileName: "IMG_0502.webp", title: "Tattoo 03", aspectRatio: "2 / 3" },
  { fileName: "7 kererū.webp", title: "Kererū" },
  { fileName: "1 floral forearm piece.webp", title: "Floral Forearm" }
] as const;

const tattooArtwork = tattooSource.map(({ fileName, title, ...item }) => ({
  fileName,
  imagePath: `/src/assets/artwork/tattoo/${fileName}` as const,
  title,
  aspectRatio: "aspectRatio" in item ? item.aspectRatio : "3 / 4"
})) satisfies GalleryArtwork[];

const drawingAspectRatios = [
  "3 / 4", "3 / 4", "4 / 5", "3 / 4", "3 / 4", "3 / 4", "4 / 5",
  "3 / 4", "4 / 5", "3 / 4", "3 / 4", "3 / 4", "3 / 4", "3 / 4",
  "3 / 4", "3 / 4", "3 / 4", "3 / 4", "3 / 4", "3 / 4", "3 / 4",
  "3 / 4", "3 / 4", "3 / 4", "1800 / 1546", "1 / 1", "1 / 1", "4 / 5"
] as const;

const drawingArtwork = drawingAspectRatios.map((aspectRatio, index) => {
  const number = String(index + 1).padStart(2, "0");
  const fileName = `drawing-${number}.webp` as const;

  return {
    fileName,
    imagePath: `/src/assets/artwork/drawings/${fileName}` as const,
    title: "Drawing " + number,
    aspectRatio
  };
}) satisfies GalleryArtwork[];

const paintingSource = [
  {
    fileName: "painting-01.webp",
    title: "A Gift",
    medium: "Gouache and graphite on paper",
    dimensions: { width: 420, height: 594, unit: "mm" },
    aspectRatio: "1273 / 1800",
    year: 2026
  },
  {
    fileName: "painting-02.webp",
    title: "The Waterlilies",
    medium: "Gouache on paper",
    dimensions: { width: 420, height: 594, unit: "mm" },
    aspectRatio: "1044 / 1501",
    year: 2026
  },
  {
    fileName: "painting-03.webp",
    title: "The Peonies",
    medium: "Gouache on paper",
    dimensions: { width: 420, height: 594, unit: "mm" },
    aspectRatio: "1055 / 1510",
    year: 2026
  },
  {
    fileName: "painting-08.webp",
    title: "Morning Glory",
    medium: "Gouache on handmade cotton rag paper",
    dimensions: { width: 240, height: 360, unit: "mm" },
    aspectRatio: "1130 / 1412",
    year: 2026
  },
  { fileName: "painting-09.webp", title: "Painting 09", aspectRatio: "1297 / 1800", year: 2026 },
  { fileName: "painting-04.webp", title: "Kererū", aspectRatio: "1 / 1", year: 2022 },
  { fileName: "painting-05.webp", title: "Kākā", aspectRatio: "1 / 1", year: 2022 },
  { fileName: "painting-06.webp", title: "Tūī", aspectRatio: "1 / 1", year: 2022 },
  { fileName: "painting-07.webp", title: "Bird studies", aspectRatio: "1800 / 1273", year: 2022 }
] as const;

const paintingArtwork = paintingSource.map(({ fileName, ...item }) => ({
  fileName,
  imagePath: `/src/assets/artwork/paintings/${fileName}` as const,
  ...item
})) satisfies GalleryArtwork[];

export const galleryCategories = [
  { id: "tattoo", label: "Tattoo", items: tattooArtwork },
  { id: "drawings", label: "Drawings", items: drawingArtwork },
  { id: "paintings", label: "Paintings", items: paintingArtwork }
] as const satisfies readonly GalleryCategory[];
