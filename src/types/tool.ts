export type ToolCategory =
  | "message"
  | "text"
  | "image"
  | "calculator"
  | "converter"
  | "generator"
  | "lifestyle"
  | "developer";

export interface ToolConfig {
  id: string;
  name: string;
  description: string;
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
  icon: string;
  description: string;
}
