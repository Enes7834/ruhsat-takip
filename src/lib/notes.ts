import { supabase } from "./supabase";

export type Note = {
  id: string;
  created_at: string;
  updated_at: string;
  title: string;
  body: string;
};

const LS = "duran_notes";

const readLS = (): Note[] => {
  try {
    return JSON.parse(localStorage.getItem(LS) ?? "[]") as Note[];
  } catch {
    return [];
  }
};
const writeLS = (v: Note[]) => localStorage.setItem(LS, JSON.stringify(v));

export async function listNotes(): Promise<Note[]> {
  if (!supabase) return readLS().sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const { data, error } = await supabase
    .from("permit_notes")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data as Note[]) ?? [];
}

export async function createNote(): Promise<Note> {
  const now = new Date().toISOString();
  const note: Note = { id: crypto.randomUUID(), created_at: now, updated_at: now, title: "", body: "" };
  if (!supabase) {
    writeLS([note, ...readLS()]);
    return note;
  }
  const { data, error } = await supabase
    .from("permit_notes")
    .insert({ title: "", body: "" })
    .select()
    .single();
  if (error) throw error;
  return data as Note;
}

export async function updateNote(id: string, patch: Partial<Pick<Note, "title" | "body">>): Promise<void> {
  const now = new Date().toISOString();
  if (!supabase) {
    writeLS(readLS().map((n) => (n.id === id ? { ...n, ...patch, updated_at: now } : n)));
    return;
  }
  const { error } = await supabase
    .from("permit_notes")
    .update({ ...patch, updated_at: now })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteNote(id: string): Promise<void> {
  if (!supabase) {
    writeLS(readLS().filter((n) => n.id !== id));
    return;
  }
  const { error } = await supabase.from("permit_notes").delete().eq("id", id);
  if (error) throw error;
}
