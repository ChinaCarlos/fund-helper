import { applyPlatformAttribute } from "@/lib/platform";
import { showMainWindow } from "@/lib/tauri";
import ReactDOM from "react-dom/client";
import App from "./App";
import "antd/dist/reset.css";
import "./styles/global.css";
import "./index.css";

applyPlatformAttribute();
void showMainWindow();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(<App />);
