import { AuthService } from "../authentication";

type PredefinedConfigLocations = "this-repo" | "local" | "remote";

export async function fetchPredefinedConfigs(location: PredefinedConfigLocations, path?: string, auth?: AuthService) {
    if (location === "this-repo" && path) {
        return fetchFromThisRepo(path);
    } else if (location === "local" && path) {
        return fetchFromLocal(path);
    } else if (location === "remote" && auth) {
        return fetchFromRemote(auth);
    } else {
        throw new Error("Invalid location");
    }
}

async function fetchFromThisRepo(path: string) {
    const response = await fetch(`https://raw.githubusercontent.com/ubiquity-os/ubiquity-os-plugin-installer/__STORAGE__/${path}`);
    const jsonData = await response.json();
    return jsonData;
}

async function fetchFromLocal(path: string) {
    const response = await fetch(`/static/${path}`);
    const jsonData = await response.json();
    return jsonData;
}

async function fetchFromRemote(auth: AuthService) {
    const { data, error } = await auth.supabase.from("predefined_configs").select("*");
    if (error) {
        throw error;
    }
    return data;
}