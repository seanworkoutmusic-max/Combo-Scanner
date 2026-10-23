def american_to_prob(a):
    if a is None:
        return None
    a = float(a)
    return 100.0 / (a + 100.0) if a > 0 else -a / (-a + 100.0)


def _power(p1, p2):
    lo, hi = 0.5, 10.0
    for _ in range(80):
        k = (lo + hi) / 2
        if p1 ** k + p2 ** k > 1:
            lo = k
        else:
            hi = k
    k = (lo + hi) / 2
    return p1 ** k


def devig_pair(p_yes, p_no):
    """Fair probability of the YES side under each method."""
    s = p_yes + p_no
    add = min(max(p_yes - (s - 1) / 2, 0.0001), 0.9999)
    return {
        "mult": p_yes / s,
        "add": add,
        "power": _power(p_yes, p_no) if s > 1 else p_yes / s,
    }


METHODS = ("mult", "add", "power")
