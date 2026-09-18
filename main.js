/* =========================================================
   HAND GALAXY
   Browser Camera + MediaPipe + Three.js
========================================================= */

const video = document.getElementById("webcam");
const cameraCanvas = document.getElementById("handCanvas");
const cameraCtx = cameraCanvas.getContext("2d");

const startButton = document.getElementById("startCamera");
const cameraMessage = document.getElementById("cameraMessage");

const statusText = document.getElementById("statusText");
const statusDot = document.getElementById("statusDot");

const gestureName = document.getElementById("gestureName");
const gestureInfo = document.getElementById("gestureInfo");
const gestureIcon = document.getElementById("gestureIcon");

let cameraStream = null;
let tracking = false;
let lastTime = 0;

const control = {
    rotate: 0,
    tilt: 0,
    blackHole: 0,
    freeze: 0,
    expand: 0
};


/* =========================================================
   THREE.JS GALAXY
========================================================= */

const container = document.getElementById("galaxy");

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    2000
);

camera.position.z = 8;

const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

container.appendChild(renderer.domElement);


/* =========================================================
   PARTICLES
========================================================= */

const particleCount = 120000;

const positions = new Float32Array(particleCount * 3);
const sizes = new Float32Array(particleCount);
const randoms = new Float32Array(particleCount);

for (let i = 0; i < particleCount; i++) {

    const i3 = i * 3;

    const radius = Math.pow(Math.random(), 0.55) * 5.8;

    const arms = 5;

    const arm =
        Math.floor(Math.random() * arms);

    const angle =
        radius * 1.8 +
        arm * ((Math.PI * 2) / arms);

    const spread =
        (Math.random() - 0.5) *
        (0.25 + radius * 0.08);

    positions[i3] =
        Math.cos(angle + spread) * radius;

    positions[i3 + 1] =
        (Math.random() - 0.5) *
        (0.25 + radius * 0.10);

    positions[i3 + 2] =
        Math.sin(angle + spread) * radius;

    sizes[i] =
        Math.random() * 2.5 + 0.5;

    randoms[i] =
        Math.random();
}


const geometry = new THREE.BufferGeometry();

geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(positions, 3)
);

geometry.setAttribute(
    "aSize",
    new THREE.BufferAttribute(sizes, 1)
);

geometry.setAttribute(
    "aRandom",
    new THREE.BufferAttribute(randoms, 1)
);


/* =========================================================
   GALAXY MATERIAL
========================================================= */

const material = new THREE.ShaderMaterial({

    transparent: true,

    depthWrite: false,

    blending: THREE.AdditiveBlending,

    uniforms: {
        uTime: {
            value: 0
        },

        uBlackHole: {
            value: 0
        },

        uExpand: {
            value: 0
        },

        uFreeze: {
            value: 0
        }
    },

    vertexShader: `

        uniform float uTime;
        uniform float uBlackHole;
        uniform float uExpand;
        uniform float uFreeze;

        attribute float aSize;
        attribute float aRandom;

        varying float vRandom;

        void main() {

            vec3 p = position;

            float time =
                uTime *
                (1.0 - uFreeze);

            float radius =
                length(p.xz);

            float angle =
                atan(p.z, p.x);

            angle +=
                time *
                (0.08 + 0.03 / max(radius, 0.5));

            float expand =
                1.0 + uExpand * 0.8;

            p.x =
                cos(angle) *
                radius *
                expand;

            p.z =
                sin(angle) *
                radius *
                expand;

            /*
                BLACK HOLE
            */

            float gravity =
                1.0 - uBlackHole * 0.75;

            p.x *= gravity;
            p.z *= gravity;

            /*
                Gentle vertical movement
            */

            p.y +=
                sin(time * 1.5 + aRandom * 20.0)
                * 0.015;

            vec4 mvPosition =
                modelViewMatrix *
                vec4(p, 1.0);

            gl_Position =
                projectionMatrix *
                mvPosition;

            gl_PointSize =
                aSize *
                (300.0 / -mvPosition.z);

            vRandom = aRandom;
        }

    `,

    fragmentShader: `

        varying float vRandom;

        void main() {

            vec2 uv =
                gl_PointCoord -
                vec2(0.5);

            float d =
                length(uv);

            float alpha =
                smoothstep(
                    0.5,
                    0.0,
                    d
                );

            vec3 colorA =
                vec3(
                    0.35,
                    0.20,
                    1.0
                );

            vec3 colorB =
                vec3(
                    1.0,
                    0.25,
                    0.85
                );

            vec3 color =
                mix(
                    colorA,
                    colorB,
                    vRandom
                );

            gl_FragColor =
                vec4(
                    color,
                    alpha * 0.85
                );
        }

    `
});


const galaxy = new THREE.Points(
    geometry,
    material
);

scene.add(galaxy);


/* =========================================================
   RESIZE
========================================================= */

window.addEventListener(
    "resize",
    () => {

        camera.aspect =
            window.innerWidth /
            window.innerHeight;

        camera.updateProjectionMatrix();

        renderer.setSize(
            window.innerWidth,
            window.innerHeight
        );
    }
);


/* =========================================================
   MEDIAPIPE
========================================================= */

let hands = null;

function initializeMediaPipe() {

    if (typeof Hands === "undefined") {

        console.error(
            "MediaPipe Hands failed to load."
        );

        statusText.textContent =
            "MEDIAPIPE ERROR";

        return;
    }


    hands = new Hands({

        locateFile: (file) => {

            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;

        }

    });


    hands.setOptions({

        maxNumHands: 2,

        modelComplexity: 1,

        minDetectionConfidence: 0.5,

        minTrackingConfidence: 0.5

    });


    hands.onResults(processHands);

    console.log(
        "MediaPipe initialized."
    );
}


initializeMediaPipe();


/* =========================================================
   HAND PROCESSING
========================================================= */

function distance(a, b) {

    const x =
        a.x - b.x;

    const y =
        a.y - b.y;

    return Math.sqrt(
        x * x +
        y * y
    );
}


function processHands(results) {

    cameraCanvas.width =
        video.videoWidth ||
        640;

    cameraCanvas.height =
        video.videoHeight ||
        480;


    cameraCtx.clearRect(
        0,
        0,
        cameraCanvas.width,
        cameraCanvas.height
    );


    if (
        !results.multiHandLandmarks ||
        results.multiHandLandmarks.length === 0
    ) {

        tracking = false;

        statusText.textContent =
            "CAMERA ACTIVE • NO HAND";

        statusDot.classList.add("active");

        gestureName.textContent =
            "NO HAND";

        gestureInfo.textContent =
            "Show your hand to the camera";

        gestureIcon.textContent =
            "✋";

        control.blackHole = 0;
        control.freeze = 0;

        return;
    }


    tracking = true;

    statusText.textContent =
        "CAMERA ACTIVE • HAND DETECTED";

    statusDot.classList.add("active");


    const handsDetected =
        results.multiHandLandmarks;


    /* =====================================================
       DRAW LANDMARKS
    ===================================================== */

    for (
        const landmarks of handsDetected
    ) {

        drawHand(landmarks);

    }


    /* =====================================================
       FIRST HAND
    ===================================================== */

    const hand =
        handsDetected[0];

    const wrist =
        hand[0];

    const thumb =
        hand[4];

    const index =
        hand[8];

    const middle =
        hand[12];

    const ring =
        hand[16];

    const pinky =
        hand[20];


    const pinchDistance =
        distance(
            thumb,
            index
        );


    const pinch =
        Math.max(
            0,
            Math.min(
                1,
                1 -
                pinchDistance / 0.12
            )
        );


    /* =====================================================
       FINGERS
    ===================================================== */

    let fingers = 0;

    if (
        hand[8].y <
        hand[6].y
    ) fingers++;

    if (
        hand[12].y <
        hand[10].y
    ) fingers++;

    if (
        hand[16].y <
        hand[14].y
    ) fingers++;

    if (
        hand[20].y <
        hand[18].y
    ) fingers++;


    const fist =
        fingers <= 1;


    const openPalm =
        fingers >= 4;


    /* =====================================================
       ROTATION
    ===================================================== */

    control.rotate =
        (wrist.x - 0.5) * 2;


    control.tilt =
        (wrist.y - 0.5) * 2;


    control.blackHole =
        pinch;


    control.freeze =
        fist ? 1 : 0;


    /* =====================================================
       TWO HANDS
    ===================================================== */

    if (
        handsDetected.length >= 2
    ) {

        const hand2 =
            handsDetected[1];

        const wrist2 =
            hand2[0];


        const twoDistance =
            distance(
                wrist,
                wrist2
            );


        control.expand =
            Math.max(
                0,
                Math.min(
                    1,
                    (twoDistance - 0.15) /
                    0.45
                )
            );


        gestureName.textContent =
            "TWO HANDS";

        gestureInfo.textContent =
            control.expand > 0.5
                ? "Expanding galaxy"
                : "Compress / expand";

        gestureIcon.textContent =
            "👐";

    }

    else {

        control.expand = 0;


        if (pinch > 0.6) {

            gestureName.textContent =
                "PINCH";

            gestureInfo.textContent =
                "Black hole activated";

            gestureIcon.textContent =
                "🤏";

        }

        else if (fist) {

            gestureName.textContent =
                "FIST";

            gestureInfo.textContent =
                "Galaxy frozen";

            gestureIcon.textContent =
                "✊";

        }

        else if (openPalm) {

            gestureName.textContent =
                "OPEN PALM";

            gestureInfo.textContent =
                "Galaxy resumed";

            gestureIcon.textContent =
                "🖐️";

        }

        else {

            gestureName.textContent =
                "MOVE HAND";

            gestureInfo.textContent =
                "Rotate and tilt galaxy";

            gestureIcon.textContent =
                "👋";

        }

    }
}


/* =========================================================
   DRAW HAND
========================================================= */

function drawHand(landmarks) {

    const connections = [

        [0,1],[1,2],[2,3],[3,4],

        [0,5],[5,6],[6,7],[7,8],

        [5,9],[9,10],[10,11],[11,12],

        [9,13],[13,14],[14,15],[15,16],

        [13,17],[17,18],[18,19],[19,20],

        [0,17]

    ];


    cameraCtx.lineWidth = 3;

    cameraCtx.strokeStyle =
        "#ffffff";


    for (
        const [a,b]
        of connections
    ) {

        const p1 =
            landmarks[a];

        const p2 =
            landmarks[b];


        cameraCtx.beginPath();

        cameraCtx.moveTo(
            p1.x *
            cameraCanvas.width,

            p1.y *
            cameraCanvas.height
        );

        cameraCtx.lineTo(
            p2.x *
            cameraCanvas.width,

            p2.y *
            cameraCanvas.height
        );

        cameraCtx.stroke();
    }


    for (
        const point
        of landmarks
    ) {

        cameraCtx.beginPath();

        cameraCtx.arc(
            point.x *
            cameraCanvas.width,

            point.y *
            cameraCanvas.height,

            5,
            0,
            Math.PI * 2
        );

        cameraCtx.fillStyle =
            "#ffffff";

        cameraCtx.fill();
    }
}


/* =========================================================
   START CAMERA
========================================================= */

async function startCamera() {

    try {

        cameraMessage.textContent =
            "REQUESTING CAMERA...";


        startButton.disabled = true;

        startButton.textContent =
            "STARTING...";


        if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia
        ) {

            throw new Error(
                "Browser camera API unavailable. Use HTTPS or localhost."
            );
        }


        cameraStream =
            await navigator.mediaDevices.getUserMedia({

                video: {

                    width: {
                        ideal: 1280
                    },

                    height: {
                        ideal: 720
                    },

                    facingMode:
                        "user"

                },

                audio: false

            });


        video.srcObject =
            cameraStream;


        await video.play();


        cameraMessage.style.display =
            "none";


        startButton.style.display =
            "none";


        statusText.textContent =
            "CAMERA ACTIVE";

        statusDot.classList.add(
            "active"
        );


        /*
            MediaPipe processing loop
        */

        async function detect() {

            if (
                video.readyState >= 2 &&
                hands
            ) {

                await hands.send({
                    image: video
                });

            }

            requestAnimationFrame(
                detect
            );
        }


        detect();

        console.log(
            "Camera started successfully."
        );

    }

    catch (error) {

        console.error(
            "Camera error:",
            error
        );


        cameraMessage.style.display =
            "block";

        cameraMessage.textContent =
            "CAMERA ERROR";


        startButton.disabled =
            false;

        startButton.textContent =
            "TRY AGAIN";


        statusText.textContent =
            "CAMERA ERROR";

        statusDot.classList.remove(
            "active"
        );


        alert(
            "Camera could not start.\n\n" +
            error.message +
            "\n\n" +
            "Please click Allow when Chrome asks for camera permission."
        );
    }
}


startButton.addEventListener(
    "click",
    startCamera
);


/* =========================================================
   GALAXY ANIMATION
========================================================= */

function animate(time) {

    requestAnimationFrame(
        animate
    );


    const delta =
        Math.min(
            (time - lastTime) / 1000,
            0.05
        );


    lastTime =
        time;


    if (!control.freeze) {

        material.uniforms.uTime.value +=
            delta;

    }


    material.uniforms.uBlackHole.value =
        THREE.MathUtils.lerp(
            material.uniforms.uBlackHole.value,
            control.blackHole,
            0.08
        );


    material.uniforms.uExpand.value =
        THREE.MathUtils.lerp(
            material.uniforms.uExpand.value,
            control.expand,
            0.08
        );


    material.uniforms.uFreeze.value =
        THREE.MathUtils.lerp(
            material.uniforms.uFreeze.value,
            control.freeze,
            0.12
        );


    galaxy.rotation.y +=
        control.rotate *
        delta *
        0.35;


    galaxy.rotation.x =
        THREE.MathUtils.lerp(
            galaxy.rotation.x,
            control.tilt * 0.8,
            0.04
        );


    renderer.render(
        scene,
        camera
    );
}


animate(0);