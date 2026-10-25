"""A fact sheet per asset: what it is and where you see it in daily life.

Gemini gets it as context to answer questions (so it doesn't make things up), and
it is the local answer when Gemini is unavailable. Only general, stable facts,
with no figures that go out of date.
"""

FICHAS: dict[str, dict[str, str]] = {
    "SPY": {
        "que_es": "A fund that holds the 500 largest US listed companies, in one purchase.",
        "dia_a_dia": "Apple, Microsoft, Amazon, Coca-Cola and Visa are inside. Buying it means owning a small slice of all of them.",
    },
    "VOO": {
        "que_es": "A fund that follows the same S&P 500 index as SPY, run by Vanguard instead of State Street.",
        "dia_a_dia": "Same 500 US companies as SPY. That is why Horizon never puts both in one plan.",
    },
    "QQQ": {
        "que_es": "A fund that holds the 100 largest non-financial companies on the Nasdaq exchange, mostly technology.",
        "dia_a_dia": "Your phone, your search engine and your streaming apps likely come from companies inside it.",
    },
    "GLD": {
        "que_es": "A fund backed by gold bars kept in vaults. Its price follows the price of gold.",
        "dia_a_dia": "People buy gold when they worry about inflation or crises. It pays no interest or dividends.",
    },
    "AAPL": {
        "que_es": "Apple designs the iPhone, Mac, iPad and Apple Watch, and sells services like iCloud and the App Store.",
        "dia_a_dia": "Every iPhone sale and every app subscription paid through the App Store adds to its revenue.",
    },
    "MSFT": {
        "que_es": "Microsoft makes Windows, Office, the Azure cloud, LinkedIn and Xbox.",
        "dia_a_dia": "When an office pays for Word, Excel or Teams, or a company rents cloud servers, part of that goes to Microsoft.",
    },
    "NVDA": {
        "que_es": "NVIDIA designs the chips that power video games and most of today's artificial intelligence.",
        "dia_a_dia": "AI chatbots and gaming PCs often run on its chips. Its price moves a lot.",
    },
    "WALMEX.MX": {
        "que_es": "Walmart de México y Centroamérica runs Walmart, Bodega Aurrerá and Sam's Club stores.",
        "dia_a_dia": "When you shop at Bodega Aurrerá or Walmart, part of what you pay ends up as this company's profit.",
    },
    "AMXB.MX": {
        "que_es": "América Móvil is a phone and internet company that owns Telcel, Telmex and Claro.",
        "dia_a_dia": "If you pay a Telcel plan or Telmex internet, you are one of its customers.",
    },
    "FEMSAUBD.MX": {
        "que_es": "FEMSA runs the OXXO convenience stores and is a large owner of Coca-Cola FEMSA, a Coca-Cola bottler.",
        "dia_a_dia": "A snack at OXXO or a Coca-Cola bottled in Mexico is FEMSA's business at work.",
    },
    "VOD.L": {
        "que_es": "Vodafone is a mobile and broadband company based in the UK, with customers across Europe and Africa.",
        "dia_a_dia": "A Vodafone SIM or home broadband bill is its revenue. Its price is in pence on the London market.",
    },
    "HSBA.L": {
        "que_es": "HSBC is one of the world's largest banks, based in London with a large business in Asia.",
        "dia_a_dia": "Banks earn from loans, cards and fees. Its profit rises and falls with interest rates.",
    },
    "SHEL.L": {
        "que_es": "Shell is an energy company that produces oil and gas and runs petrol stations.",
        "dia_a_dia": "Filling up at a Shell station is its business. Its price follows oil and gas prices.",
    },
    "^GSPC": {
        "que_es": "The S&P 500 index: a score of the 500 largest US companies.",
        "dia_a_dia": "You cannot buy an index directly. You invest through a fund that copies it, like SPY or VOO.",
    },
    "^FTSE": {
        "que_es": "The FTSE 100 index: a score of the 100 largest companies on the London Stock Exchange.",
        "dia_a_dia": "Shell, HSBC and Unilever are inside. You invest in it through a fund that copies it.",
    },
    "^MXX": {
        "que_es": "The S&P/BMV IPC index: a score of the largest companies on the Mexican Stock Exchange.",
        "dia_a_dia": "Walmart de México, América Móvil and FEMSA are inside. You invest in it through a fund that copies it.",
    },
    "GBPUSD=X": {
        "que_es": "The exchange rate: how many US dollars one British pound buys.",
        "dia_a_dia": "If it goes up, a trip to the US gets cheaper for someone paid in pounds.",
    },
    "MXN=X": {
        "que_es": "The exchange rate: how many Mexican pesos one US dollar buys.",
        "dia_a_dia": "If it goes up, the peso is weaker: imported phones and US trips cost more pesos.",
    },
    "BTCUSDT": {
        "que_es": "Bitcoin is a digital currency with a fixed supply, run by a network of computers instead of a bank.",
        "dia_a_dia": "It is not a company and pays nothing. Its price depends only on what buyers will pay, so it swings a lot.",
    },
    "ETHUSDT": {
        "que_es": "Ethereum is a network for running programs and digital tokens. Ether is its currency.",
        "dia_a_dia": "Many crypto apps run on it. Like Bitcoin, it pays nothing and its price swings a lot.",
    },
    "SOLUSDT": {
        "que_es": "Solana is a fast crypto network for apps and payments. SOL is its currency.",
        "dia_a_dia": "It is younger and riskier than Bitcoin. Large drops have happened in short periods.",
    },
}


def texto_ficha(simbolo: str) -> str | None:
    f = FICHAS.get(simbolo)
    if not f:
        return None
    return f"{f['que_es']} {f['dia_a_dia']}"


# Glossary for when Gemini is unavailable: (trigger words, answer).
GLOSARIO: list[tuple[tuple[str, ...], str]] = [
    (("dividend",), "A dividend is part of a company's profit paid to its shareholders, often a few times a year. "
                    "Not every company pays one, and crypto never does."),
    (("etf",), "An ETF is a fund you buy like a share. One purchase gives you a small slice of many companies, "
               "so one bad company hurts less."),
    (("index",), "An index is a score that follows a group of companies, like the S&P 500. "
                 "You cannot buy it directly; you buy a fund that copies it."),
    (("chance of loss",), "Chance of loss is the model's estimate of how likely you are to end the period with less "
                          "than you put in. Near 50% means it is close to a coin toss."),
    (("90%", "range"), "The 90% range is where the model expects the result to land 9 times out of 10. "
                       "One time in 10 it can land outside, better or worse."),
    (("bad scenario", "worst"), "The bad scenario is the low end of that range: a loss that happens about 1 time in 20. "
                                "Horizon sizes your investment so this loss fits your profile."),
    (("spread", "diversif", "several assets"), "Spreading money across assets means one bad result hurts less. "
                                               "If one company has a bad year, the others can soften the hit."),
    (("cash",), "Cash is money you keep aside, not invested. Here it does not grow, but it does not fall either, "
                "and you can invest it later."),
    (("inflation",), "Inflation means prices rise over time, so the same money buys less. "
                     "Investing aims to grow your money faster than prices rise."),
    (("only part", "this amount", "why invest"), "Horizon invests only the amount whose bad-case loss fits your profile. "
                                                 "The rest waits, so a bad month cannot hurt more than you said you accept."),
]

PREGUNTA_DE_ACTIVO = ("do?", " do ", "company", "really", "daily life", "business")


def glosario(pregunta: str) -> str | None:
    p = pregunta.lower()
    return next((texto for claves, texto in GLOSARIO if any(c in p for c in claves)), None)
