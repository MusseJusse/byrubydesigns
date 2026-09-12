// @ts-check
import { defineConfig } from "astro/config";
import vercel from "@astrojs/vercel";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  output: "static",
  site: "https://www.byrubydesigns.com",
  adapter: vercel({
    imageService: true,
    imagesConfig: {
      sizes: [
        44, 88, 128, 200, 240, 256, 360, 480, 640, 720, 1080, 1200, 1440, 1600,
      ],
      domains: [],
      formats: ["image/webp"],
    },
  }),
  integrations: [sitemap()]
});
