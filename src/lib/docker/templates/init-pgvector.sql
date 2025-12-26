-- Initialize pgvector extension and create example tables
-- This script runs automatically when the pgvector container starts

-- Enable the vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create a sample embeddings table
CREATE TABLE IF NOT EXISTS embeddings (
    id BIGSERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    embedding vector(1536), -- OpenAI text-embedding-3-small dimension
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for similarity search
CREATE INDEX IF NOT EXISTS embeddings_embedding_idx 
ON embeddings USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Create a documents table for RAG applications
CREATE TABLE IF NOT EXISTS documents (
    id BIGSERIAL PRIMARY KEY,
    title TEXT,
    content TEXT NOT NULL,
    source TEXT,
    metadata JSONB DEFAULT '{}',
    embedding vector(1536),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for document similarity search
CREATE INDEX IF NOT EXISTS documents_embedding_idx 
ON documents USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Create helper function for similarity search
CREATE OR REPLACE FUNCTION match_documents(
    query_embedding vector(1536),
    match_threshold float DEFAULT 0.7,
    match_count int DEFAULT 10
)
RETURNS TABLE (
    id bigint,
    title text,
    content text,
    source text,
    metadata jsonb,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        documents.id,
        documents.title,
        documents.content,
        documents.source,
        documents.metadata,
        1 - (documents.embedding <=> query_embedding) as similarity
    FROM documents
    WHERE 1 - (documents.embedding <=> query_embedding) > match_threshold
    ORDER BY documents.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO evolvo;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO evolvo;
