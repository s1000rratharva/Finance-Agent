"""Chunking, number parsing and hybrid fusion tests."""

from app.services.ingestion.extractors import parse_number, _match_label
from app.services.rag.chunker import chunk_text, split_sentences
from app.services.rag.hybrid import rrf_fuse
from app.services.rag.bm25 import _StableBM25, tokenize


# --- chunker --------------------------------------------------------------------


def test_split_sentences_keeps_content():
    sentences = split_sentences("Revenue grew 12%. Margin held at 18%. Debt rose.")
    assert len(sentences) == 3


def test_chunk_text_respects_size():
    text = " ".join(f"Sentence number {i} about financial results." for i in range(60))
    chunks = chunk_text(text, chunk_size=40, chunk_overlap=8)
    assert len(chunks) > 1
    assert all(c.index >= 0 for c in chunks)
    # overlap means consecutive chunks share no empty payload
    assert all(c.text.strip() for c in chunks)


def test_chunk_text_handles_empty_input():
    assert chunk_text("") == []
    assert chunk_text("   \n\n  ") == []


def test_chunk_carries_page_and_section():
    chunks = chunk_text("Some filing text here.", page=7, section="Liquidity")
    assert chunks[0].page == 7
    assert chunks[0].section == "Liquidity"


# --- number parsing --------------------------------------------------------------


def test_parse_plain_number():
    assert parse_number("1234") == 1234.0


def test_parse_indian_comma_format():
    assert parse_number("1,02,592.50") == 102592.5


def test_parse_parenthesised_negative():
    assert parse_number("(1,234)") == -1234.0


def test_parse_currency_and_scale_suffixes():
    assert parse_number("₹45.6 cr") == 45.6
    assert parse_number("$1,234 mn") == 1234.0


def test_parse_percentage():
    assert parse_number("18.5%") == 18.5


def test_parse_garbage_is_none():
    assert parse_number("") is None
    assert parse_number("-") is None
    assert parse_number("N/A") is None


def test_label_matching():
    assert _match_label("total revenue") == "revenue"
    assert _match_label("revenue from operations") == "revenue"
    assert _match_label("profit after tax") == "net_profit"
    assert _match_label("shareholders equity") == "total_equity"
    assert _match_label("random prose about markets") is None


# --- hybrid fusion ---------------------------------------------------------------


def test_rrf_prefers_items_ranked_high_in_any_list():
    dense = [{"id": "a", "score": 0.9, "text": "a"},
             {"id": "b", "score": 0.8, "text": "b"}]
    sparse = [{"id": "c", "score": 12.0, "text": "c"},
              {"id": "a", "score": 9.0, "text": "a"}]

    fused = rrf_fuse([dense, sparse])
    ids = [item["id"] for item in fused]

    assert set(ids) == {"a", "b", "c"}
    # 'a' appears high in both lists, so it must win overall
    assert ids[0] == "a"


def test_rrf_respects_weights():
    only_dense = [{"id": "dense-1", "score": 0.5}]
    only_sparse = [{"id": "sparse-1", "score": 3.0}]

    fused = rrf_fuse([only_dense, only_sparse], weights=[1.0, 0.1])
    assert fused[0]["id"] == "dense-1"


def test_rrf_top_k_limits_output():
    ranking = [{"id": str(i), "score": 1.0 / (i + 1)} for i in range(50)]
    fused = rrf_fuse([ranking], top_k=5)
    assert len(fused) == 5


def test_rrf_empty_inputs():
    assert rrf_fuse([[], []]) == []


# --- sparse retrieval ------------------------------------------------------------


def test_bm25_scores_are_positive_for_single_document_corpus():
    """A fresh workspace often has just one chunk.

    Upstream ``BM25Okapi`` substitutes negative IDFs with a negative epsilon,
    which used to make every score negative and silently hide valid hits.
    """
    engine = _StableBM25([tokenize("metric FY2024 FY2025 Total Revenue 899041 964643")])
    scores = engine.get_scores(tokenize("revenue FY2025"))
    assert scores[0] > 0


def test_bm25_ranks_matching_term_above_unrelated_term():
    engine = _StableBM25([
        tokenize("Total Revenue 899041 964643"),
        tokenize("Net Profit 79020 91002"),
    ])
    scores = engine.get_scores(tokenize("revenue"))
    assert scores[0] > scores[1]
