export type ToolCategory =
  | "message"
  | "text"
  | "image"
  | "calculator"
  | "converter"
  | "generator"
  | "lifestyle"
  | "developer"
  | "finance"
  | "game";

export interface ToolConfig {
  id: string;
  name: string;
  nameKey?: string; // i18n key
  description: string;
  descriptionKey?: string; // i18n key
  category: ToolCategory;
  icon: string; // lucide-react icon name
  path: string;
  isNew?: boolean;
  isPopular?: boolean;
  keywords?: string[]; // for SEO & search
}

export interface CategoryConfig {
  id: ToolCategory;
  name: string;
  nameKey?: string; // i18n key
  icon: string;
  description: string;
}
