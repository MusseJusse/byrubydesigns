export type GalleryArtwork = {
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

type GalleryCategory = {
  id: string;
  label: string;
  intro: readonly string[];
  items: readonly GalleryArtwork[];
};

const tattooSource = [
  { fileName: "IMG_6601.webp" },
  { fileName: "IMG_3554.webp" },
  { fileName: "IMG_3112.webp" },
  { fileName: "IMG_2526.webp" },
  { fileName: "IMG_2522.webp" },
  { fileName: "IMG_2233.webp" },
  { fileName: "IMG_1356.webp" },
  { fileName: "IMG_1220.webp" },
  { fileName: "IMG_1163.webp", aspectRatio: "2 / 3" },
  { fileName: "IMG_0545.webp", aspectRatio: "1 / 1" },
  { fileName: "IMG_0502.webp", aspectRatio: "2 / 3" },
  { fileName: "7 kererū.webp" },
  { fileName: "1 floral forearm piece.webp" }
] as const;

function numberedTitle(label: "Tattoo" | "Drawing", index: number) {
  return `${label} ${String(index + 1).padStart(2, "0")}`;
}

const tattooArtwork = tattooSource.map(({ fileName, ...item }, index) => {
  return {
    imagePath: `/src/assets/artwork/tattoo/${fileName}` as const,
    title: numberedTitle("Tattoo", index),
    aspectRatio: "aspectRatio" in item ? item.aspectRatio : "3 / 4"
  };
}) satisfies GalleryArtwork[];

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
    imagePath: `/src/assets/artwork/drawings/${fileName}` as const,
    title: numberedTitle("Drawing", index),
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
    title: "Irises and Daffodils revisited",
    medium: "Gouache on paper",
    dimensions: { width: 210, height: 296, unit: "mm" },
    aspectRatio: "1130 / 1412",
    year: 2026
  },
  {
    fileName: "painting-09.webp",
    title: "The Sisters",
    medium: "Gouache on paper",
    dimensions: { width: 420, height: 594, unit: "mm" },
    aspectRatio: "1297 / 1800",
    year: 2026
  },
  {
    fileName: "painting-10.webp",
    title: "Morning Glory",
    medium: "Gouache on handmade cotton rag paper",
    dimensions: { width: 240, height: 360, unit: "mm" },
    aspectRatio: "2480 / 3508",
    year: 2026
  },
  { fileName: "painting-04.webp", title: "Kererū", aspectRatio: "1 / 1", year: 2022 },
  { fileName: "painting-05.webp", title: "Kākā", aspectRatio: "1 / 1", year: 2022 },
  { fileName: "painting-06.webp", title: "Tūī", aspectRatio: "1 / 1", year: 2022 },
  { fileName: "painting-07.webp", title: "Bird studies", aspectRatio: "1800 / 1273", year: 2022 }
] as const;

const paintingArtwork = paintingSource.map(({ fileName, ...item }) => ({
  imagePath: `/src/assets/artwork/paintings/${fileName}` as const,
  ...item
})) satisfies GalleryArtwork[];

export const galleryCategories = [
  {
    id: "tattoo",
    label: "Tattoos",
    intro: [
      "Originally trained in Auckland, New Zealand, I have been tattooing since 2022 and now work out of Inkdependent Studio near Edinburgh’s Haymarket station.",
      "Fully licensed, I do custom and my own original designs with a focus on fine-line black-and-grey."
    ],
    items: tattooArtwork
  },
  {
    id: "drawings",
    label: "Drawings",
    intro: [
      "A series of hand-sized flash designs rendered in ballpoint pen, available for tattooing.",
      "These pieces explore core themes in my work—from delicate flora and pollinators to skulls and wildlife—all balanced with soft shading and natural placement in mind."
    ],
    items: drawingArtwork
  },
  {
    id: "paintings",
    label: "Paintings",
    intro: ["“It's all there, the strangeness, colour, exhilaration.” Rita Angus"],
    items: paintingArtwork
  }
] as const satisfies readonly GalleryCategory[];

export type GalleryCategoryId = (typeof galleryCategories)[number]["id"];
