import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getDeckByShareToken } from "@/lib/decks";
import DeckViewer from "./DeckViewer";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { shareToken: string };
}): Promise<Metadata> {
  const deck = await getDeckByShareToken(params.shareToken);
  return { title: deck?.title ?? "Deck", robots: { index: false } };
}

export default async function DeckPage({
  params,
  searchParams,
}: {
  params: { shareToken: string };
  searchParams: { print?: string };
}) {
  const deck = await getDeckByShareToken(params.shareToken);
  if (!deck) notFound();
  return (
    <DeckViewer
      model={deck.model}
      title={deck.title}
      print={searchParams.print === "1"}
    />
  );
}
