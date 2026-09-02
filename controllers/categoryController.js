import prisma from "../config/prismaClient.js";
import helper from "../helper/helper.js";

const DEFAULT_CATEGORIES = [
  {
    name: "Interior Design",
    description: "Residential, commercial, and bespoke interior spaces",
    specializations: ["Interior Designer", "3D Visualizer", "Vastu Consultant"],
  },
  {
    name: "Exterior & Architecture",
    description: "Structural, landscape, and facade exterior styling",
    specializations: ["Exterior Designer", "Landscape Designer", "Structural Designer"],
  },
  {
    name: "Drafting & Modeling",
    description: "Technical drafting, 3D modeling, BIM, and product design",
    specializations: ["AutoCAD Designer", "BIM Designer", "Product Designer"],
  },
];

class CategoryController {
  /**
   * Fetch all categories and their related specializations from database
   * GET /api/Auth/categories-specializations
   */
  static async getCategoriesAndSpecializations(req, res) {
    try {
      let categories = await prisma.category.findMany({
        include: {
          specializations: {
            select: {
              id: true,
              name: true,
            },
            orderBy: { name: "asc" },
          },
        },
        orderBy: { name: "asc" },
      });

      // Auto-seed default categories if database is currently empty
      if (categories.length === 0) {
        for (const cat of DEFAULT_CATEGORIES) {
          const createdCat = await prisma.category.upsert({
            where: { name: cat.name },
            update: {},
            create: {
              name: cat.name,
              description: cat.description,
            },
          });

          for (const specName of cat.specializations) {
            await prisma.specialization.upsert({
              where: {
                name_categoryId: {
                  name: specName,
                  categoryId: createdCat.id,
                },
              },
              update: {},
              create: {
                name: specName,
                categoryId: createdCat.id,
              },
            });
          }
        }

        categories = await prisma.category.findMany({
          include: {
            specializations: {
              select: {
                id: true,
                name: true,
              },
              orderBy: { name: "asc" },
            },
          },
          orderBy: { name: "asc" },
        });
      }
      return helper.success(
        res,
        "Categories and specializations fetched successfully",
        categories
      );
    } catch (error) {
      console.error("Error fetching categories and specializations:", error);
      // Fallback: return default categories so registration flow never blocks
      const dummyCategories = DEFAULT_CATEGORIES.map((cat, i) => ({
        id: `dummy-cat-${i + 1}`,
        name: cat.name,
        description: cat.description,
        specializations: cat.specializations.map((s, j) => ({
          id: `dummy-spec-${i + 1}-${j + 1}`,
          name: s,
        })),
      }));
      return helper.success(
        res,
        "Categories and specializations fetched successfully (fallback)",
        dummyCategories
      );
    }
  }
}

export default CategoryController;
