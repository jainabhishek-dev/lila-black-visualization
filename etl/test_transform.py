"""
Unit tests for coordinate transform in etl.py
Run: python test_transform.py
"""
import sys
sys.path.insert(0, ".")
from etl import world_to_pixel, is_bot_user, parse_filename

def test_ambrose_valley_example():
    """README example: x=-301.45, z=-355.55 -> px~78, py~890"""
    px, py = world_to_pixel(-301.45, -355.55, "AmbroseValley")
    assert abs(px - 78)  < 2, f"px expected ~78, got {px}"
    assert abs(py - 890) < 2, f"py expected ~890, got {py}"
    print(f"  PASS: AmbroseValley example: ({px}, {py})")

def test_pixel_clamp():
    """Extreme coords should clamp to [0, 1024]"""
    px, py = world_to_pixel(99999, 99999, "AmbroseValley")
    assert 0 <= px <= 1024
    assert 0 <= py <= 1024
    print(f"  PASS: Clamp test: ({px}, {py})")

def test_bot_detection():
    assert is_bot_user("1440") == True
    assert is_bot_user("382")  == True
    assert is_bot_user("f4e072fa-b7af-4761-b567-1d95b7ad0108") == False
    print("  PASS: Bot/human detection works")

def test_parse_human_filename():
    name = "f4e072fa-b7af-4761-b567-1d95b7ad0108_b71aaad8-aa62-4b3a-8534-927d4de18f22.nakama-0"
    uid, mid = parse_filename(name)
    assert uid == "f4e072fa-b7af-4761-b567-1d95b7ad0108", f"Got uid: {uid}"
    assert mid == "b71aaad8-aa62-4b3a-8534-927d4de18f22", f"Got mid: {mid}"
    print(f"  PASS: Human filename: uid={uid[:8]}..., mid={mid[:8]}...")

def test_parse_bot_filename():
    name = "1440_d7e50fad-fb7a-4ed4-932f-e4ca9ff0c97b.nakama-0"
    uid, mid = parse_filename(name)
    assert uid == "1440", f"Got uid: {uid}"
    assert mid == "d7e50fad-fb7a-4ed4-932f-e4ca9ff0c97b", f"Got mid: {mid}"
    print(f"  PASS: Bot filename: uid={uid}, mid={mid[:8]}...")

if __name__ == "__main__":
    print("Running ETL unit tests...\n")
    tests = [
        test_ambrose_valley_example,
        test_pixel_clamp,
        test_bot_detection,
        test_parse_human_filename,
        test_parse_bot_filename,
    ]
    passed = 0
    for t in tests:
        try:
            t()
            passed += 1
        except AssertionError as e:
            print(f"  FAIL: {t.__name__}: {e}")
    status = "ALL PASSED" if passed == len(tests) else "SOME FAILED"
    print(f"\n{status}: {passed}/{len(tests)} tests passed")
