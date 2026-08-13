import { createRoot } from "react-dom/client";

const rootElement = document.getElementById("root");

if (rootElement === null) {
  throw new Error("Renderer root element is missing.");
}

createRoot(rootElement).render(<p>DeepSeek Harness desktop scaffold.</p>);
