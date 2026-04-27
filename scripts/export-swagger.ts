import { swaggerSpec } from "../src/config/swagger";
import fs from "fs";
import path from "path";

const outputPath = path.resolve(__dirname, "../developer-portal/static/swagger.json");

// Ensure directory exists (though static/ should exist)
const dir = path.dirname(outputPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

fs.writeFileSync(outputPath, JSON.stringify(swaggerSpec, null, 2));
console.log(`Swagger JSON exported to ${outputPath}`);
