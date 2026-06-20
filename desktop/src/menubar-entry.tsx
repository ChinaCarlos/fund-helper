import ReactDOM from "react-dom/client";
import { MenubarPopoverApp } from "./MenubarPopoverApp";
import "./styles/menubar-popover.css";

function applySystemTheme() {
  const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.dataset.platform = "macos";
}

applySystemTheme();
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applySystemTheme);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(<MenubarPopoverApp />);
