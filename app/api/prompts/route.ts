import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";


// ✅ GET — fetch all prompts
export async function GET() {
  const { data, error } = await supabaseServer
    .from("prompts")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}


// ✅ POST — create prompt
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, content, category } = body;

    if (!title || !content) {
      return NextResponse.json(
        { error: "Title and content required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseServer
      .from("prompts")
      .insert([{ title, content, category }])
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data, { status: 201 });

  } catch {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}
