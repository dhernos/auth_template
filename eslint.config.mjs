import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              // import Source which should be blocked
              name: "next/navigation",
              // forbidden imports
              importNames: ["useRouter", "redirect", "permanentRedirect", "usePathname"],
              message: "Please use hooks and functions from 'next-intl'."
            },
            {
              // import Source which should be blocked
              name: "prisma/client",
              // forbidden imports
              importNames: ["PrismaClient"],
              message: "Please use db import."
            }
          ]
        }
      ]
    }
  }
];

export default eslintConfig;
