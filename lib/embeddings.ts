import { embeddingsProvider } from "@/lib/embeddings-provider";
import prisma from "@/lib/prisma";

const MAX_KNOWLEDGE_CONSIDERED = 8;
const MAX_KNOWLEDGE_LENGTH = 40000; // ~10000 tokens

export async function generateEmbedding(document: string): Promise<number[]> {
  const input = document.slice(0, MAX_KNOWLEDGE_LENGTH).replace(/\n/g, " ");
  const embeddingData = await embeddingsProvider.embeddings.create({
    model: process.env.EMBEDDINGS_API_MODEL!,
    input,
  });
  const [{ embedding }] = embeddingData.data;
  return embedding;
}

export async function getMostRelevantKnowledge(
  aiId: string,
  query: string,
  numResults = 1,
) {
  if (!query.trim().length) {
    return [];
  }

  const embedding = await generateEmbedding(query);
  const vector = `[${embedding.join(",")}]`;
  const results = await prisma.$queryRaw`
    SELECT id, content
    FROM "Knowledge"
    WHERE "aiId" = ${aiId}
    AND learned = TRUE
    ORDER BY vector <=> ${vector}::vector
    LIMIT ${numResults};
  `;

  return results as {
    id: string;
    content: string | null;
  }[];
}

export async function getContext(aiId: string, query: string) {
  const relevantKnowledge = await getMostRelevantKnowledge(
    aiId,
    query,
    MAX_KNOWLEDGE_CONSIDERED,
  );
  return relevantKnowledge
    .map((knowledge) => knowledge.content)
    .join("\n\n")
    .slice(0, MAX_KNOWLEDGE_LENGTH);
}
