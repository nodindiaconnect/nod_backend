import prisma from "../config/prismaClient.js";
import helper from "../helper/helper.js";

const DEFAULT_CATEGORIES = [
  {
    name: "Interior Designer",
    description: "Residential, commercial, luxury, and modular interior spaces",
    specializations: [
      "Residential Interior",
      "Commercial & Office Interior",
      "Modular Kitchen & Wardrobe",
      "Hospitality & Restaurant",
      "Living & Luxury Spaces",
      "Retail & Showroom Design",
    ],
  },
  {
    name: "Exterior Designer",
    description: "Architectural elevations, facades, and exterior remodeling",
    specializations: [
      "Residential Elevation",
      "Commercial Facade Design",
      "Modern Villa Elevation",
      "Facade & Cladding Design",
      "Exterior Remodeling & Lighting",
    ],
  },
  {
    name: "AutoCAD Drafter",
    description: "2D architectural drafting, working drawings, and MEP layouts",
    specializations: [
      "2D Architectural Drafting",
      "Working & Detail Drawings",
      "MEP & HVAC Drafting",
      "Approval & Submission Drawings",
      "Structural Layout Drafting",
    ],
  },
  {
    name: "Landscape Designer",
    description: "Gardens, outdoor living spaces, terrace, and urban landscaping",
    specializations: [
      "Garden & Lawn Design",
      "Terrace & Balcony Gardens",
      "Urban & Public Landscapes",
      "Farmhouse & Resort Landscapes",
      "Hardscape & Water Features",
    ],
  },
  {
    name: "BIM Engineer",
    description: "Building information modeling, Revit coordination, and clash detection",
    specializations: [
      "Revit BIM Modeling",
      "Clash Detection & Coordination",
      "4D / 5D BIM Simulation",
      "MEP BIM Modeling",
      "Structural BIM Engineering",
    ],
  },
  {
    name: "Product Designer",
    description: "Custom furniture, lighting, millwork, and decorative products",
    specializations: [
      "Custom Furniture Design",
      "Lighting & Luminaire Design",
      "Home Decor & Artifacts",
      "Millwork & Joinery Design",
      "Industrial Product Design",
    ],
  },
  {
    name: "Graphic Designer",
    description: "Environmental signage, architectural presentations, murals, and branding",
    specializations: [
      "Environmental & Signage Graphics",
      "Architectural Presentation & Pitch Decks",
      "Wall Art & Murals",
      "Brand Identity & Signage",
      "Marketing Collateral & 3D Infographics",
    ],
  },
  {
    name: "3D Modeler",
    description: "3D architectural modeling, photorealistic rendering, and texturing",
    specializations: [
      "3D Architectural Modeling",
      "Photorealistic Rendering",
      "3ds Max / Blender / SketchUp Modeling",
      "Furniture & Prop 3D Modeling",
      "Texturing & Lighting Specialist",
    ],
  },
  {
    name: "Walkthrough Specialist",
    description: "Architectural animations, virtual reality, and 360° virtual tours",
    specializations: [
      "3D Architectural Animation",
      "Lumion / Unreal Engine Walkthrough",
      "360° Virtual Tours & Panoramas",
      "Real-Time VR Experiences",
      "Cinematic Video Rendering",
    ],
  },
  {
    name: "Estimation Engineer",
    description: "BOQ preparation, quantity surveying, cost estimation, and rate analysis",
    specializations: [
      "BOQ & Cost Estimation",
      "Quantity Surveying & Material Takeoff",
      "Material & Labor Costing",
      "Rate Analysis & Budgeting",
      "Tender & Contract Estimation",
    ],
  },
];

const OBSOLETE_CATEGORIES = [
  "Interior Design",
  "Exterior & Architecture",
  "Drafting & Modeling",
];

class CategoryController {
  /**
   * Fetch all categories and their related specializations from database
   * GET /api/Auth/categories-specializations
   */
  static async getCategoriesAndSpecializations(req, res) {
    try {
      // 1. Clean up obsolete generic categories if present
      try {
        await prisma.category.deleteMany({
          where: { name: { in: OBSOLETE_CATEGORIES } },
        });
      } catch (cleanErr) {
        console.warn("Notice: Obsolete category cleanup skipped:", cleanErr.message);
      }

      // 2. Ensure all 10 default designer categories and specializations are seeded
      for (const cat of DEFAULT_CATEGORIES) {
        const createdCat = await prisma.category.upsert({
          where: { name: cat.name },
          update: {
            description: cat.description,
          },
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

      // 3. Query all registered categories with their specializations
      const categories = await prisma.category.findMany({
        where: {
          name: { in: DEFAULT_CATEGORIES.map((c) => c.name) },
        },
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

      return helper.success(
        res,
        "Categories and specializations fetched successfully",
        categories
      );
    } catch (error) {
      console.error("Error fetching categories and specializations:", error);
      // Fallback: return default categories so registration and project flows never block
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
