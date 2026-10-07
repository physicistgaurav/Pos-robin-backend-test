import slugify from "slugify";

export function createBaseSlug(text: string): string {
    return slugify(text, {
      lower: true,
      strict: true,
      trim: true,
    });
  }

  export async function generateUniqueSlug(
    text: string,
    existsFn: (slug: string) => Promise<boolean>
  ): Promise<string> {
    const base = createBaseSlug(text);
    let slug = base;
    let count = 1;
  
    while (await existsFn(slug)) {
      slug = `${base}-${count++}`;
    }
  
    return slug;
  }
  