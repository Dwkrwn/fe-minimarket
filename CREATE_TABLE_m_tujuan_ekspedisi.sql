-- SQL Script untuk membuat tabel m_tujuan_ekspedisi
-- Tabel detail untuk menyimpan kota-kota tujuan dari setiap ekspedisi

CREATE TABLE IF NOT EXISTS m_tujuan_ekspedisi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    m_ekspedisi_id UUID NOT NULL,
    nama_provinsi VARCHAR(255) NOT NULL,
    nama_kota VARCHAR(255) NOT NULL,
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraint ke tabel m_ekspedisi
    CONSTRAINT fk_m_ekspedisi
        FOREIGN KEY (m_ekspedisi_id)
        REFERENCES m_ekspedisi(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    
    -- Index untuk pencarian yang lebih cepat
    CONSTRAINT unique_ekspedisi_kota UNIQUE (m_ekspedisi_id, nama_provinsi, nama_kota)
);

-- Create indexes untuk performa
CREATE INDEX IF NOT EXISTS idx_m_tujuan_ekspedisi_ekspedisi_id 
    ON m_tujuan_ekspedisi(m_ekspedisi_id);

CREATE INDEX IF NOT EXISTS idx_m_tujuan_ekspedisi_provinsi 
    ON m_tujuan_ekspedisi(nama_provinsi);

CREATE INDEX IF NOT EXISTS idx_m_tujuan_ekspedisi_kota 
    ON m_tujuan_ekspedisi(nama_kota);

-- Create trigger untuk auto-update updatedAt
CREATE OR REPLACE FUNCTION update_m_tujuan_ekspedisi_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_m_tujuan_ekspedisi_updated_at
    BEFORE UPDATE ON m_tujuan_ekspedisi
    FOR EACH ROW
    EXECUTE FUNCTION update_m_tujuan_ekspedisi_updated_at();

-- Komentar untuk dokumentasi
COMMENT ON TABLE m_tujuan_ekspedisi IS 'Tabel detail untuk menyimpan kota-kota tujuan pengiriman dari setiap ekspedisi';
COMMENT ON COLUMN m_tujuan_ekspedisi.id IS 'Primary key UUID';
COMMENT ON COLUMN m_tujuan_ekspedisi.m_ekspedisi_id IS 'Foreign key ke tabel m_ekspedisi';
COMMENT ON COLUMN m_tujuan_ekspedisi.nama_provinsi IS 'Nama provinsi dari kota tujuan';
COMMENT ON COLUMN m_tujuan_ekspedisi.nama_kota IS 'Nama kota tujuan pengiriman';
