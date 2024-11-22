import { AuthService } from "../authentication";

type PredefinedConfigLocations = "this-repo" | "local" | "remote";

export async function fetchPredefinedConfigs(location: PredefinedConfigLocations, auth?: AuthService) {
    if (location === "this-repo") {
        return fetchFromThisRepo();
    } else if (location === "local") {
        return fetchFromLocal();
    } else if (location === "remote") {
        return fetchFromRemote(auth);
    } else {
        throw new Error("Invalid location");
    }
}

async function fetchFromThisRepo() {
    const response = await fetch("https://raw.githubusercontent.com/ubiquity-os/ubiquity-os-plugin-installer/__STORAGE__/predefined-configs.json");
    const jsonData = await response.json();
    return jsonData;
}

async function fetchFromLocal() {
    const response = await fetch("/static/predefined-configs.json");
    const jsonData = await response.json();
    return jsonData;
}

async function fetchFromRemote(auth?: AuthService) {
    if (!auth) {
        throw new Error("Auth service is required for fetching remote predefined configs");
    }
    const { data, error } = await auth.supabase.from("predefined_configs").select("*");
    if (error) {
        throw error;
    }
    return data;
}