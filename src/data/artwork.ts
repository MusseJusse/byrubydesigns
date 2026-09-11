export type GalleryArtwork = {
  imagePath: `/src/assets/artwork/${string}.webp`;
  title: string;
  aspectRatio: string;
  caption?: string;
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
  { fileName: "IMG_6601.webp", title: "Skull and rose" },
  { fileName: "IMG_3554.webp", title: "Floral arrangement" },
  { fileName: "IMG_3112.webp", title: "Spotted moth" },
  { fileName: "IMG_2526.webp", title: "Butterfly" },
  { fileName: "IMG_2522.webp", title: "Peacock butterfly" },
  {
    fileName: "IMG_2233.webp",
    title: "Inkdependent Studio",
    caption: "Studio photograph"
  },
  {
    fileName: "IMG_1356.webp",
    title: "Inkdependent Studio",
    caption: "Studio photograph"
  },
  { fileName: "IMG_1220.webp", title: "Bird in flight" },
  { fileName: "IMG_1163.webp", title: "Iris memorial", aspectRatio: "2 / 3" },
  { fileName: "IMG_0545.webp", title: "Sun and moon", aspectRatio: "1 / 1" },
  { fileName: "IMG_0502.webp", title: "Floral back piece", aspectRatio: "2 / 3" },
  { fileName: "7 kererū.webp", title: "Kererū" },
  { fileName: "1 floral forearm piece.webp", title: "Hibiscus and sunflower" }
] as const;

const tattooArtwork = tattooSource.map(({ fileName, ...item }) => {
  return {
    imagePath: `/src/assets/artwork/tattoo/${fileName}` as const,
    ...item,
    aspectRatio: "aspectRatio" in item ? item.aspectRatio : "3 / 4"
  };
}) satisfies GalleryArtwork[];

const drawingSource = [
  { fileName: "drawing-01.webp", title: "Panther and flowers", aspectRatio: "3 / 4" },
  { fileName: "drawing-02.webp", title: "Swallow and flowers", aspectRatio: "3 / 4" },
  { fileName: "drawing-03.webp", title: "Floral and insect studies", aspectRatio: "4 / 5" },
  { fileName: "drawing-04.webp", title: "Rose and dragonfly", aspectRatio: "3 / 4" },
  { fileName: "drawing-05.webp", title: "Birds in flight", aspectRatio: "3 / 4" },
  { fileName: "drawing-06.webp", title: "Floral pair", aspectRatio: "3 / 4" },
  { fileName: "drawing-07.webp", title: "Butterfly studies", aspectRatio: "4 / 5" },
  { fileName: "drawing-08.webp", title: "Floral wreath", aspectRatio: "3 / 4" },
  { fileName: "drawing-10.webp", title: "Peony", aspectRatio: "3 / 4" },
  { fileName: "drawing-11.webp", title: "Bramble blossom and bee", aspectRatio: "3 / 4" },
  { fileName: "drawing-12.webp", title: "Bird and blossom", aspectRatio: "3 / 4" },
  { fileName: "drawing-13.webp", title: "Flash studies", aspectRatio: "3 / 4" },
  { fileName: "drawing-15.webp", title: "Tiger", aspectRatio: "3 / 4" },
  { fileName: "drawing-16.webp", title: "Butterfly, skull and rose studies", aspectRatio: "3 / 4" },
  { fileName: "drawing-17.webp", title: "Floral studies", aspectRatio: "3 / 4" },
  { fileName: "drawing-18.webp", title: "Pair of birds and blossoms", aspectRatio: "3 / 4" },
  { fileName: "drawing-19.webp", title: "Bird and flower", aspectRatio: "3 / 4" },
  { fileName: "drawing-20.webp", title: "Skull and rose", aspectRatio: "3 / 4" },
  { fileName: "drawing-21.webp", title: "Butterfly studies", aspectRatio: "3 / 4" },
  { fileName: "drawing-25.webp", title: "Moths and pollinators", aspectRatio: "1800 / 1546" },
  { fileName: "drawing-26.webp", title: "Botanical flash studies", aspectRatio: "1 / 1" },
  { fileName: "drawing-27.webp", title: "Figurative flash studies", aspectRatio: "1 / 1" }
] as const;

const drawingArtwork = drawingSource.map(({ fileName, ...item }) => ({
  imagePath: `/src/assets/artwork/drawings/${fileName}` as const,
  ...item
})) satisfies GalleryArtwork[];

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
