import cv2
import mediapipe as mp

print("MediaPipe version:", mp.__version__)

mp_hands = mp.solutions.hands
mp_draw = mp.solutions.drawing_utils

hands = mp_hands.Hands(
    static_image_mode=False,
    max_num_hands=2,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
)

cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)

if not cap.isOpened():
    print("ERROR: Cannot open webcam.")
    exit()

print("Webcam started.")
print("Show your hand.")
print("Press Q to quit.")

while True:
    success, frame = cap.read()

    if not success:
        print("Failed to read webcam frame.")
        break

    # Mirror webcam
    frame = cv2.flip(frame, 1)

    # Convert BGR -> RGB
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

    # Process ONLY ONCE
    result = hands.process(rgb)

    # Draw detected hands
    if result.multi_hand_landmarks:
        for hand_landmarks in result.multi_hand_landmarks:

            mp_draw.draw_landmarks(
                frame,
                hand_landmarks,
                mp_hands.HAND_CONNECTIONS
            )

            # Palm/wrist position
            wrist = hand_landmarks.landmark[
                mp_hands.HandLandmark.WRIST
            ]

            x = int(wrist.x * frame.shape[1])
            y = int(wrist.y * frame.shape[0])

            cv2.circle(
                frame,
                (x, y),
                10,
                (0, 255, 0),
                -1
            )

            cv2.putText(
                frame,
                f"Hand: {x}, {y}",
                (x + 15, y),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (0, 255, 0),
                2
            )

    cv2.imshow("Hand Galaxy - Hand Tracking Test", frame)

    # Q = quit
    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

cap.release()
hands.close()
cv2.destroyAllWindows()

print("Webcam closed.")