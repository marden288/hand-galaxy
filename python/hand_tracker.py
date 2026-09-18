import asyncio
import json
import math
import threading
import cv2
import mediapipe as mp
import websockets


# ============================================================
# MEDIAPIPE
# ============================================================

mp_hands = mp.solutions.hands
mp_draw = mp.solutions.drawing_utils

hands = mp_hands.Hands(
    static_image_mode=False,
    max_num_hands=2,

    # LOWER = easier detection
    min_detection_confidence=0.40,

    # HIGHER = better tracking stability
    min_tracking_confidence=0.50,

    # Faster on CPU
    model_complexity=0
)


# ============================================================
# SHARED DATA
# ============================================================

hand_data = {
    "hands": 0,

    "left": {
        "x": 0.5,
        "y": 0.5,
        "pinch": 0.0,
        "fist": 0.0,
        "open": 0.0
    },

    "right": {
        "x": 0.5,
        "y": 0.5,
        "pinch": 0.0,
        "fist": 0.0,
        "open": 0.0
    },

    "two_hand_distance": 0.0,

    "rotate": 0.0,
    "tilt": 0.0,
    "black_hole": 0.0,
    "freeze": 0.0,
    "expand": 0.0
}

data_lock = threading.Lock()


# ============================================================
# SMOOTHING
# ============================================================

smooth_left_x = 0.5
smooth_left_y = 0.5

smooth_right_x = 0.5
smooth_right_y = 0.5


def smooth(old, new, amount=0.35):
    return old + (new - old) * amount


# ============================================================
# DISTANCE
# ============================================================

def distance(a, b):

    return math.sqrt(
        (a.x - b.x) ** 2 +
        (a.y - b.y) ** 2 +
        (a.z - b.z) ** 2
    )


# ============================================================
# GESTURE DETECTION
# ============================================================

def calculate_gestures(landmarks):

    # Tips
    thumb_tip = landmarks[
        mp_hands.HandLandmark.THUMB_TIP
    ]

    index_tip = landmarks[
        mp_hands.HandLandmark.INDEX_FINGER_TIP
    ]

    middle_tip = landmarks[
        mp_hands.HandLandmark.MIDDLE_FINGER_TIP
    ]

    ring_tip = landmarks[
        mp_hands.HandLandmark.RING_FINGER_TIP
    ]

    pinky_tip = landmarks[
        mp_hands.HandLandmark.PINKY_TIP
    ]

    # PIP
    index_pip = landmarks[
        mp_hands.HandLandmark.INDEX_FINGER_PIP
    ]

    middle_pip = landmarks[
        mp_hands.HandLandmark.MIDDLE_FINGER_PIP
    ]

    ring_pip = landmarks[
        mp_hands.HandLandmark.RING_FINGER_PIP
    ]

    pinky_pip = landmarks[
        mp_hands.HandLandmark.PINKY_PIP
    ]

    # --------------------------------------------------------
    # PINCH
    # --------------------------------------------------------

    pinch_distance = distance(
        thumb_tip,
        index_tip
    )

    pinch = max(
        0.0,
        min(
            1.0,
            1.0 - pinch_distance / 0.13
        )
    )

    # --------------------------------------------------------
    # EXTENDED FINGERS
    # --------------------------------------------------------

    fingers = 0

    if index_tip.y < index_pip.y:
        fingers += 1

    if middle_tip.y < middle_pip.y:
        fingers += 1

    if ring_tip.y < ring_pip.y:
        fingers += 1

    if pinky_tip.y < pinky_pip.y:
        fingers += 1

    # --------------------------------------------------------
    # GESTURES
    # --------------------------------------------------------

    fist = 1.0 if fingers <= 1 else 0.0

    open_palm = 1.0 if fingers >= 4 else 0.0

    return pinch, fist, open_palm


# ============================================================
# CAMERA
# ============================================================

def camera_loop():

    global hand_data

    global smooth_left_x
    global smooth_left_y
    global smooth_right_x
    global smooth_right_y

    # DirectShow usually works better on Windows
    cap = cv2.VideoCapture(
        0,
        cv2.CAP_DSHOW
    )

    if not cap.isOpened():

        print("ERROR: Cannot open webcam.")

        return

    # --------------------------------------------------------
    # CAMERA SETTINGS
    # --------------------------------------------------------

    cap.set(
        cv2.CAP_PROP_FRAME_WIDTH,
        960
    )

    cap.set(
        cv2.CAP_PROP_FRAME_HEIGHT,
        540
    )

    cap.set(
        cv2.CAP_PROP_FPS,
        30
    )

    print()
    print("==========================================")
    print("       HAND GALAXY CONTROLLER")
    print("==========================================")
    print("Webcam started.")
    print()
    print("Move hand       = Rotate")
    print("Move up/down    = Tilt")
    print("Pinch           = Black Hole")
    print("Fist            = Freeze")
    print("Open Palm       = Resume")
    print("Two Hands       = Expand")
    print()
    print("Press Q to quit.")
    print("==========================================")
    print()

    # --------------------------------------------------------
    # LOST FRAME COUNTER
    # --------------------------------------------------------

    lost_frames = 0

    while True:

        success, frame = cap.read()

        if not success:
            continue

        # Mirror
        frame = cv2.flip(
            frame,
            1
        )

        # ----------------------------------------------------
        # RGB
        # ----------------------------------------------------

        rgb = cv2.cvtColor(
            frame,
            cv2.COLOR_BGR2RGB
        )

        # Improve performance
        rgb.flags.writeable = False

        result = hands.process(
            rgb
        )

        rgb.flags.writeable = True

        detected = []

        # ====================================================
        # DETECT HANDS
        # ====================================================

        if result.multi_hand_landmarks:

            lost_frames = 0

            for landmarks in result.multi_hand_landmarks:

                lm = landmarks.landmark

                pinch, fist, open_palm = \
                    calculate_gestures(lm)

                # Use WRIST for stable position
                wrist = lm[
                    mp_hands.HandLandmark.WRIST
                ]

                detected.append({

                    "x": float(wrist.x),

                    "y": float(wrist.y),

                    "pinch": float(pinch),

                    "fist": float(fist),

                    "open": float(open_palm),

                    "landmarks": landmarks

                })

        else:

            lost_frames += 1

        # ====================================================
        # SORT HANDS
        # ====================================================

        detected.sort(
            key=lambda h: h["x"]
        )

        # ====================================================
        # DATA
        # ====================================================

        with data_lock:

            hand_data["hands"] = len(
                detected
            )

            # ------------------------------------------------
            # LEFT HAND
            # ------------------------------------------------

            if len(detected) >= 1:

                h = detected[0]

                smooth_left_x = smooth(
                    smooth_left_x,
                    h["x"],
                    0.30
                )

                smooth_left_y = smooth(
                    smooth_left_y,
                    h["y"],
                    0.30
                )

                hand_data["left"] = {

                    "x": smooth_left_x,

                    "y": smooth_left_y,

                    "pinch": h["pinch"],

                    "fist": h["fist"],

                    "open": h["open"]

                }

            # ------------------------------------------------
            # RIGHT HAND
            # ------------------------------------------------

            if len(detected) >= 2:

                h = detected[1]

                smooth_right_x = smooth(
                    smooth_right_x,
                    h["x"],
                    0.30
                )

                smooth_right_y = smooth(
                    smooth_right_y,
                    h["y"],
                    0.30
                )

                hand_data["right"] = {

                    "x": smooth_right_x,

                    "y": smooth_right_y,

                    "pinch": h["pinch"],

                    "fist": h["fist"],

                    "open": h["open"]

                }

            # ------------------------------------------------
            # SINGLE HAND
            # ------------------------------------------------

            if len(detected) == 1:

                x = smooth_left_x
                y = smooth_left_y

                hand_data["rotate"] = (
                    x - 0.5
                ) * 2.0

                hand_data["tilt"] = (
                    y - 0.5
                ) * 2.0

                hand_data["black_hole"] = \
                    detected[0]["pinch"]

                hand_data["freeze"] = \
                    detected[0]["fist"]

            # ------------------------------------------------
            # TWO HANDS
            # ------------------------------------------------

            elif len(detected) >= 2:

                center_x = (
                    smooth_left_x +
                    smooth_right_x
                ) / 2.0

                center_y = (
                    smooth_left_y +
                    smooth_right_y
                ) / 2.0

                hand_data["rotate"] = (
                    center_x - 0.5
                ) * 2.0

                hand_data["tilt"] = (
                    center_y - 0.5
                ) * 2.0

                # Distance
                dx = (
                    smooth_right_x -
                    smooth_left_x
                )

                dy = (
                    smooth_right_y -
                    smooth_left_y
                )

                d = math.sqrt(
                    dx * dx +
                    dy * dy
                )

                hand_data[
                    "two_hand_distance"
                ] = d

                # Expansion
                expand = max(
                    0.0,
                    min(
                        1.0,
                        (d - 0.15) /
                        0.55
                    )
                )

                hand_data[
                    "expand"
                ] = expand

                hand_data[
                    "black_hole"
                ] = max(
                    detected[0]["pinch"],
                    detected[1]["pinch"]
                )

                hand_data[
                    "freeze"
                ] = max(
                    detected[0]["fist"],
                    detected[1]["fist"]
                )

            # ------------------------------------------------
            # KEEP VALUES DURING BRIEF LOST DETECTION
            # ------------------------------------------------

            elif lost_frames < 8:

                # Don't immediately destroy the control data
                pass

            else:

                hand_data["hands"] = 0

                hand_data["black_hole"] = 0

                hand_data["freeze"] = 0

                hand_data["expand"] = 0

        # ====================================================
        # DRAW
        # ====================================================

        if result.multi_hand_landmarks:

            for landmarks in result.multi_hand_landmarks:

                mp_draw.draw_landmarks(

                    frame,

                    landmarks,

                    mp_hands.HAND_CONNECTIONS

                )

        # ====================================================
        # STATUS
        # ====================================================

        with data_lock:

            current = dict(
                hand_data
            )

        cv2.rectangle(
            frame,
            (10, 10),
            (410, 215),
            (0, 0, 0),
            -1
        )

        cv2.putText(
            frame,
            f"Hands: {current['hands']}",
            (25, 40),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.65,
            (255, 255, 255),
            2
        )

        cv2.putText(
            frame,
            f"Rotate: {current['rotate']:.2f}",
            (25, 70),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            (255, 255, 255),
            2
        )

        cv2.putText(
            frame,
            f"Tilt: {current['tilt']:.2f}",
            (25, 100),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            (255, 255, 255),
            2
        )

        cv2.putText(
            frame,
            f"Pinch: {current['black_hole']:.2f}",
            (25, 130),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            (255, 255, 255),
            2
        )

        cv2.putText(
            frame,
            f"Freeze: {current['freeze']:.0f}",
            (25, 160),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            (255, 255, 255),
            2
        )

        cv2.putText(
            frame,
            f"Expand: {current['expand']:.2f}",
            (25, 190),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            (255, 255, 255),
            2
        )

        cv2.imshow(
            "Hand Galaxy Controller",
            frame
        )

        # ====================================================
        # QUIT
        # ====================================================

        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    cap.release()

    cv2.destroyAllWindows()

    hands.close()


# ============================================================
# WEBSOCKET SERVER
# ============================================================

async def websocket_handler(websocket):

    print(
        "WebSocket client connected."
    )

    try:

        while True:

            with data_lock:

                data = json.dumps(
                    hand_data
                )

            await websocket.send(
                data
            )

            await asyncio.sleep(
                0.03
            )

    except websockets.exceptions.ConnectionClosed:

        print(
            "WebSocket client disconnected."
        )


async def websocket_server():

    print(
        "WebSocket server starting..."
    )

    print(
        "ws://localhost:8765"
    )

    async with websockets.serve(
        websocket_handler,
        "localhost",
        8765
    ):

        await asyncio.Future()


# ============================================================
# MAIN
# ============================================================

def main():

    camera_thread = threading.Thread(
        target=camera_loop,
        daemon=True
    )

    camera_thread.start()

    try:

        asyncio.run(
            websocket_server()
        )

    except KeyboardInterrupt:

        print(
            "Server stopped."
        )


if __name__ == "__main__":
    main()