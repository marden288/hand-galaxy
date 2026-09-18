/* =========================================================
   HAND GALAXY
   Three.js + MediaPipe Hands + Browser Webcam
========================================================= */

const video = document.getElementById("webcam");
const handCanvas = document.getElementById("handCanvas");
const handCtx = handCanvas.getContext("2d");

const startButton = document.getElementById("startCamera");
const cameraMessage = document.getElementById("cameraMessage");

const statusText = document.getElementById("statusText");
const statusDot = document.getElementById("statusDot");

const gestureName = document.getElementById("gestureName");
const gestureInfo = document.getElementById("gestureInfo");
const gestureIcon = document.getElementById("gestureIcon");


/* =========================================================
   CONTROL STATE
========================================================= */

const control = {
    rotate: 0,
    tilt: 0,
    blackHole: 0,
    freeze: 0,
    expand: 0
};


/* =========================================================
   THREE.JS
========================================================= */

const galaxyContainer =
    document.getElementById("galaxy");

const scene =
    new THREE.Scene();

const camera =
    new THREE.PerspectiveCamera(
        52,
        window.innerWidth / window.innerHeight,
        0.1,
        100
    );

camera.position.set(
    0,
    1.8,
    12
);


const renderer =
    new THREE.WebGLRenderer({
        antialias: true,
        alpha: true
    });

renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, 1.7)
);

renderer.setSize(
    window.innerWidth,
    window.innerHeight
);

renderer.outputColorSpace =
    THREE.SRGBColorSpace;

galaxyContainer.appendChild(
    renderer.domElement
);


/* =========================================================
   GALAXY GROUP
========================================================= */

const galaxyGroup =
    new THREE.Group();

scene.add(galaxyGroup);


/* =========================================================
   PARTICLES
========================================================= */

const PARTICLES = 95000;

const positions =
    new Float32Array(PARTICLES * 3);

const colors =
    new Float32Array(PARTICLES * 3);

const sizes =
    new Float32Array(PARTICLES);

const randoms =
    new Float32Array(PARTICLES);


/* deterministic-ish random helper */

function randomGaussian() {

    let u = 0;
    let v = 0;

    while (u === 0) {
        u = Math.random();
    }

    while (v === 0) {
        v = Math.random();
    }

    return Math.sqrt(
        -2 * Math.log(u)
    ) *
    Math.cos(
        Math.PI * 2 * v
    );
}


for (let i = 0; i < PARTICLES; i++) {

    const i3 = i * 3;

    /*
        Radius

        More stars near center,
        but still enough outer stars.
    */

    const radius =
        Math.pow(
            Math.random(),
            0.62
        ) * 6.2;


    /*
        6 spiral arms
    */

    const armCount = 6;

    const arm =
        Math.floor(
            Math.random() * armCount
        );


    /*
        Spiral angle
    */

    const spiralAngle =
        arm *
        (Math.PI * 2 / armCount)
        +
        radius * 0.85;


    /*
        Natural star spread
    */

    const spread =
        randomGaussian() *
        (
            0.06 +
            radius * 0.055
        );


    const angle =
        spiralAngle +
        spread;


    /*
        Flatten galaxy disk
    */

    const height =
        randomGaussian() *
        (
            0.035 +
            radius * 0.018
        );


    positions[i3] =
        Math.cos(angle) *
        radius;

    positions[i3 + 1] =
        height;

    positions[i3 + 2] =
        Math.sin(angle) *
        radius;


    /*
        Star size

        VERY IMPORTANT:
        Small values prevent white blob.
    */

    const nearCenter =
        1 -
        Math.min(radius / 6.2, 1);

    sizes[i] =
        (
            0.45 +
            Math.random() * 1.15
        )
        *
        (
            1 +
            nearCenter * 0.45
        );


    randoms[i] =
        Math.random();


    /*
        Galaxy colors

        center = warm
        middle = pink
        outer = blue/purple
    */

    const t =
        Math.min(
            radius / 6.2,
            1
        );


    let r;
    let g;
    let b;


    if (t < 0.25) {

        /*
            Core
        */

        const k =
            t / 0.25;

        r =
            1.0;

        g =
            0.75 -
            k * 0.25;

        b =
            0.45 +
            k * 0.35;

    }

    else {

        /*
            Outer galaxy
        */

        const k =
            (t - 0.25) / 0.75;

        r =
            1.0 -
            k * 0.45;

        g =
            0.35 +
            k * 0.20;

        b =
            0.95 +
            k * 0.05;

    }


    /*
        slight variation
    */

    const variation =
        0.82 +
        Math.random() * 0.18;

    colors[i3] =
        r * variation;

    colors[i3 + 1] =
        g * variation;

    colors[i3 + 2] =
        b * variation;
}


/* =========================================================
   GEOMETRY
========================================================= */

const galaxyGeometry =
    new THREE.BufferGeometry();

galaxyGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(
        positions,
        3
    )
);

galaxyGeometry.setAttribute(
    "aColor",
    new THREE.BufferAttribute(
        colors,
        3
    )
);

galaxyGeometry.setAttribute(
    "aSize",
    new THREE.BufferAttribute(
        sizes,
        1
    )
);

galaxyGeometry.setAttribute(
    "aRandom",
    new THREE.BufferAttribute(
        randoms,
        1
    )
);


/* =========================================================
   GALAXY SHADER
========================================================= */

const galaxyMaterial =
    new THREE.ShaderMaterial({

        transparent: true,

        depthWrite: false,

        blending:
            THREE.AdditiveBlending,

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

            attribute vec3 aColor;
            attribute float aSize;
            attribute float aRandom;

            varying vec3 vColor;
            varying float vRandom;


            void main() {

                vec3 p = position;

                float radius =
                    length(p.xz);


                /*
                    Rotation

                    Slow and cinematic.
                */

                float rotation =
                    uTime *
                    (0.035 + 0.015 /
                    max(radius, 0.5));


                /*
                    Black hole gravity

                    Pinch pulls stars toward center.
                */

                float gravity =
                    1.0 -
                    uBlackHole *
                    0.82 *
                    (1.0 -
                    min(radius / 6.2, 1.0));


                p.x *= gravity;
                p.z *= gravity;


                /*
                    Expand galaxy
                */

                float expansion =
                    1.0 +
                    uExpand * 0.45;

                p.xz *= expansion;


                /*
                    Rotation around Y
                */

                float c =
                    cos(rotation);

                float s =
                    sin(rotation);

                vec2 rotated;

                rotated.x =
                    p.x * c -
                    p.z * s;

                rotated.y =
                    p.x * s +
                    p.z * c;

                p.x =
                    rotated.x;

                p.z =
                    rotated.y;


                /*
                    Freeze
                */

                float movement =
                    uTime *
                    (
                        1.0 -
                        uFreeze
                    );


                /*
                    Subtle star motion
                */

                p.y +=
                    sin(
                        movement * 1.5 +
                        aRandom * 20.0
                    ) *
                    0.012;


                vec4 mvPosition =
                    modelViewMatrix *
                    vec4(
                        p,
                        1.0
                    );


                gl_Position =
                    projectionMatrix *
                    mvPosition;


                /*
                    SMALL STAR SIZE
                */

                gl_PointSize =
                    aSize *
                    (
                        38.0 /
                        max(
                            -mvPosition.z,
                            1.0
                        )
                    );


                gl_PointSize =
                    clamp(
                        gl_PointSize,
                        0.8,
                        4.0
                    );


                vColor =
                    aColor;

                vRandom =
                    aRandom;

            }

        `,


        fragmentShader: `

            varying vec3 vColor;
            varying float vRandom;


            void main() {

                vec2 uv =
                    gl_PointCoord -
                    vec2(0.5);


                float distanceFromCenter =
                    length(uv);


                /*
                    Round star
                */

                float alpha =
                    1.0 -
                    smoothstep(
                        0.05,
                        0.5,
                        distanceFromCenter
                    );


                /*
                    Soft star glow
                */

                float glow =
                    exp(
                        -distanceFromCenter *
                        7.0
                    );


                alpha *=
                    0.65 +
                    glow * 0.35;


                if (alpha < 0.02) {
                    discard;
                }


                gl_FragColor =
                    vec4(
                        vColor,
                        alpha * 0.9
                    );

            }

        `

    });


const galaxyParticles =
    new THREE.Points(
        galaxyGeometry,
        galaxyMaterial
    );

galaxyGroup.add(
    galaxyParticles
);


/* =========================================================
   CENTRAL BLACK HOLE
========================================================= */

const blackHoleGeometry =
    new THREE.SphereGeometry(
        0.45,
        32,
        32
    );


const blackHoleMaterial =
    new THREE.MeshBasicMaterial({
        color: 0x000000
    });


const blackHole =
    new THREE.Mesh(
        blackHoleGeometry,
        blackHoleMaterial
    );

galaxyGroup.add(
    blackHole
);


/* =========================================================
   BLACK HOLE GLOW RING
========================================================= */

const ringGeometry =
    new THREE.RingGeometry(
        0.48,
        0.72,
        96
    );


const ringMaterial =
    new THREE.MeshBasicMaterial({

        color: 0xff66ff,

        transparent: true,

        opacity: 0.42,

        side:
            THREE.DoubleSide,

        blending:
            THREE.AdditiveBlending,

        depthWrite: false

    });


const ring =
    new THREE.Mesh(
        ringGeometry,
        ringMaterial
    );


ring.rotation.x =
    Math.PI / 2;

galaxyGroup.add(
    ring
);


/* =========================================================
   CAMERA LIGHT / BACKGROUND
========================================================= */

scene.background =
    new THREE.Color(
        0x000000
    );


/* =========================================================
   MEDIAPIPE
========================================================= */

let hands = null;


function initializeMediaPipe() {

    if (
        typeof Hands ===
        "undefined"
    ) {

        console.error(
            "MediaPipe Hands not loaded."
        );

        statusText.textContent =
            "MEDIAPIPE ERROR";

        return;
    }


    hands =
        new Hands({

            locateFile: (file) => {

                return (
                    "https://cdn.jsdelivr.net/npm/" +
                    "@mediapipe/hands/" +
                    file
                );

            }

        });


    hands.setOptions({

        maxNumHands: 2,

        modelComplexity: 1,

        minDetectionConfidence:
            0.5,

        minTrackingConfidence:
            0.5

    });


    hands.onResults(
        processHands
    );


    console.log(
        "MediaPipe ready."
    );
}


initializeMediaPipe();


/* =========================================================
   DISTANCE
========================================================= */

function distance(a, b) {

    const dx =
        a.x - b.x;

    const dy =
        a.y - b.y;

    return Math.sqrt(
        dx * dx +
        dy * dy
    );
}


/* =========================================================
   HAND RESULTS
========================================================= */

function processHands(results) {

    handCanvas.width =
        video.videoWidth ||
        640;

    handCanvas.height =
        video.videoHeight ||
        480;


    handCtx.clearRect(
        0,
        0,
        handCanvas.width,
        handCanvas.height
    );


    const detected =
        results.multiHandLandmarks;


    if (
        !detected ||
        detected.length === 0
    ) {

        statusText.textContent =
            "CAMERA ACTIVE • NO HAND";

        gestureName.textContent =
            "NO HAND";

        gestureInfo.textContent =
            "Show your hand to the camera";

        gestureIcon.textContent =
            "✋";

        control.blackHole =
            0;

        control.freeze =
            0;

        control.expand =
            0;

        return;
    }


    /*
        Draw hand
    */

    detected.forEach(
        drawHand
    );


    const hand =
        detected[0];


    const wrist =
        hand[0];

    const thumb =
        hand[4];

    const index =
        hand[8];


    /*
        Pinch
    */

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
                pinchDistance /
                0.13
            )
        );


    /*
        Finger counting
    */

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


    /*
        Rotation
    */

    control.rotate =
        (wrist.x - 0.5) *
        2;


    /*
        Tilt
    */

    control.tilt =
        (wrist.y - 0.5) *
        2;


    control.blackHole =
        pinch;


    control.freeze =
        fist ? 1 : 0;


    /*
        Two hands
    */

    if (
        detected.length >= 2
    ) {

        const hand2 =
            detected[1];


        const distanceBetween =
            distance(
                hand[0],
                hand2[0]
            );


        control.expand =
            Math.max(
                0,
                Math.min(
                    1,
                    (
                        distanceBetween -
                        0.18
                    ) / 0.42
                )
            );


        gestureIcon.textContent =
            "👐";

        gestureName.textContent =
            "TWO HANDS";

        gestureInfo.textContent =
            control.expand > 0.5
                ? "Galaxy expanding"
                : "Move hands apart";

    }

    else if (
        pinch > 0.65
    ) {

        gestureIcon.textContent =
            "🤏";

        gestureName.textContent =
            "BLACK HOLE";

        gestureInfo.textContent =
            "Gravity activated";

    }

    else if (fist) {

        gestureIcon.textContent =
            "✊";

        gestureName.textContent =
            "FROZEN";

        gestureInfo.textContent =
            "Galaxy movement stopped";

    }

    else if (openPalm) {

        gestureIcon.textContent =
            "🖐️";

        gestureName.textContent =
            "OPEN PALM";

        gestureInfo.textContent =
            "Galaxy resumed";

    }

    else {

        gestureIcon.textContent =
            "👋";

        gestureName.textContent =
            "MOVE HAND";

        gestureInfo.textContent =
            "Rotate and tilt galaxy";

    }


    statusText.textContent =
        "CAMERA ACTIVE • HAND DETECTED";
}


/* =========================================================
   DRAW HAND
========================================================= */

function drawHand(landmarks) {

    const connections = [

        [0,1],
        [1,2],
        [2,3],
        [3,4],

        [0,5],
        [5,6],
        [6,7],
        [7,8],

        [5,9],
        [9,10],
        [10,11],
        [11,12],

        [9,13],
        [13,14],
        [14,15],
        [15,16],

        [13,17],
        [17,18],
        [18,19],
        [19,20],

        [0,17]

    ];


    handCtx.lineWidth = 2;

    handCtx.strokeStyle =
        "rgba(255,255,255,0.85)";


    for (
        const [a,b]
        of connections
    ) {

        const p1 =
            landmarks[a];

        const p2 =
            landmarks[b];


        handCtx.beginPath();

        handCtx.moveTo(
            p1.x *
            handCanvas.width,

            p1.y *
            handCanvas.height
        );

        handCtx.lineTo(
            p2.x *
            handCanvas.width,

            p2.y *
            handCanvas.height
        );

        handCtx.stroke();

    }


    for (
        const point
        of landmarks
    ) {

        handCtx.beginPath();

        handCtx.arc(

            point.x *
            handCanvas.width,

            point.y *
            handCanvas.height,

            3,

            0,
            Math.PI * 2

        );

        handCtx.fillStyle =
            "#ffffff";

        handCtx.fill();

    }
}


/* =========================================================
   START CAMERA
========================================================= */

async function startCamera() {

    try {

        startButton.disabled =
            true;

        startButton.textContent =
            "STARTING...";


        cameraMessage.textContent =
            "REQUESTING CAMERA";


        const stream =
            await navigator.mediaDevices
                .getUserMedia({

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
            stream;


        await video.play();


        cameraMessage.style.display =
            "none";


        startButton.style.display =
            "none";


        statusDot.classList.add(
            "active"
        );


        statusText.textContent =
            "CAMERA ACTIVE • NO HAND";


        /*
            MediaPipe loop
        */

        async function detect() {

            if (
                video.readyState >= 2 &&
                hands
            ) {

                try {

                    await hands.send({
                        image: video
                    });

                }

                catch (error) {

                    console.error(
                        "MediaPipe:",
                        error
                    );

                }

            }

            requestAnimationFrame(
                detect
            );

        }


        detect();


        console.log(
            "Camera started."
        );

    }

    catch (error) {

        console.error(
            error
        );


        startButton.disabled =
            false;

        startButton.textContent =
            "TRY AGAIN";


        cameraMessage.textContent =
            "CAMERA ERROR";


        statusText.textContent =
            "CAMERA ERROR";


        alert(
            "Camera error:\n\n" +
            error.message
        );

    }
}


startButton.addEventListener(
    "click",
    startCamera
);


/* =========================================================
   ANIMATION
========================================================= */

let previousTime =
    performance.now();


function animate(currentTime) {

    requestAnimationFrame(
        animate
    );


    const delta =
        Math.min(
            (
                currentTime -
                previousTime
            ) / 1000,
            0.05
        );


    previousTime =
        currentTime;


    /*
        Galaxy time
    */

    if (
        !control.freeze
    ) {

        galaxyMaterial
            .uniforms
            .uTime
            .value +=
            delta;

    }


    /*
        Smooth black hole
    */

    galaxyMaterial
        .uniforms
        .uBlackHole
        .value =
        THREE.MathUtils.lerp(

            galaxyMaterial
                .uniforms
                .uBlackHole
                .value,

            control.blackHole,

            0.08

        );


    /*
        Smooth expansion
    */

    galaxyMaterial
        .uniforms
        .uExpand
        .value =
        THREE.MathUtils.lerp(

            galaxyMaterial
                .uniforms
                .uExpand
                .value,

            control.expand,

            0.08

        );


    /*
        Smooth freeze
    */

    galaxyMaterial
        .uniforms
        .uFreeze
        .value =
        THREE.MathUtils.lerp(

            galaxyMaterial
                .uniforms
                .uFreeze
                .value,

            control.freeze,

            0.1

        );


    /*
        Hand rotation
    */

    galaxyGroup.rotation.y +=
        control.rotate *
        delta *
        0.22;


    /*
        Hand tilt
    */

    galaxyGroup.rotation.x =
        THREE.MathUtils.lerp(

            galaxyGroup.rotation.x,

            control.tilt *
            0.42,

            0.035

        );


    /*
        Slow black hole ring
    */

    ring.rotation.z +=
        delta *
        0.35;


    /*
        Very subtle floating motion
    */

    galaxyGroup.position.y =
        Math.sin(
            currentTime *
            0.00025
        ) *
        0.08;


    renderer.render(
        scene,
        camera
    );

}


animate(
    performance.now()
);


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