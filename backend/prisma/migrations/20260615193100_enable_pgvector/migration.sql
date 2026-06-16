-- Active l'extension pgvector (recherche sémantique RAG — Module 5).
-- La colonne `vector` + index seront ajoutés au Module 5 (le schéma utilise
-- aujourd'hui `KnowledgeItem.embedding Float[]`).
CREATE EXTENSION IF NOT EXISTS vector;
