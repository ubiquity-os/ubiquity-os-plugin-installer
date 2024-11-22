import { toastNotification } from "../../utils/toaster";
import { fetchPredefinedConfigs } from "./fetch-configs";

type TemplateTypes = "minimal" | "full-defaults" | "custom";

export async function configTemplateHandler(type: TemplateTypes) {
    if (type === "minimal") {
        return handleMinimalTemplate();
    } else if (type === "full-defaults") {
        return handleFullDefaultsTemplate();
    } else if (type === "custom") {
        return handleCustomTemplate();
    } else {
        throw new Error("Invalid template type");
    }
}

async function handleMinimalTemplate() {
    try {
        const data = await fetchPredefinedConfigs("local", "minimal-predefined.json");
        if (!data) {
            throw new Error("No data found");
        }
        return data;
    } catch (error) {
        toastNotification("Failed to fetch minimal predefined config", { type: "error" });
        throw error;
    }
}

// requires more thought
async function handleFullDefaultsTemplate() {


}

// renders as-is prior to this PR
async function handleCustomTemplate() {

}
