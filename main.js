import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";


// ============================================================
// SCENE
// ============================================================

const scene = new THREE.Scene();


// ============================================================
// CAMERA
// ============================================================

const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    2000
);

camera.position.set(0, 18, 42);


// ============================================================
// RENDERER
// ============================================================

const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance"
});

renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, 2)
);

renderer.setSize(
    window.innerWidth,
    window.innerHeight
);

document.body.appendChild(
    renderer.domElement
);


// ============================================================
// GALAXY PARAMETERS
// ============================================================

const PARTICLES = 180000;

const positions = new Float32Array(
    PARTICLES * 3
);

const colors = new Float32Array(
    PARTICLES * 3
);

const sizes = new Float32Array(
    PARTICLES
);


// ============================================================
// GALAXY GENERATION
// ============================================================

for (let i = 0; i < PARTICLES; i++) {

    const i3 = i * 3;

    const radius =
        Math.pow(Math.random(), 0.55) * 32;

    const arms = 5;

    const arm =
        i % arms;

    const armAngle =
        (arm / arms) * Math.PI * 2;

    const spiral =
        radius * 0.35;

    const angle =
        armAngle +
        spiral +
        (Math.random() - 0.5) *
        (0.35 + radius * 0.025);

    const thickness =
        (Math.random() - 0.5) *
        Math.max(0.15, radius * 0.10);

    const x =
        Math.cos(angle) * radius;

    const z =
        Math.sin(angle) * radius;

    const y =
        thickness;

    positions[i3] =
        x;

    positions[i3 + 1] =
        y;

    positions[i3 + 2] =
        z;

    // Galaxy color
    const center =
        Math.max(0, 1 - radius / 32);

    colors[i3] =
        0.35 + center * 0.65;

    colors[i3 + 1] =
        0.15 + Math.random() * 0.35;

    colors[i3 + 2] =
        0.75 + Math.random() * 0.25;

    sizes[i] =
        1.0 + Math.random() * 3.0;
}


// ============================================================
// GEOMETRY
// ============================================================

const geometry =
    new THREE.BufferGeometry();

geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(
        positions,
        3
    )
);

geometry.setAttribute(
    "color",
    new THREE.BufferAttribute(
        colors,
        3
    )
);

geometry.setAttribute(
    "aSize",
    new THREE.BufferAttribute(
        sizes,
        1
    )
);


// ============================================================
// SHADER MATERIAL
// ============================================================

const material =
    new THREE.ShaderMaterial({

        transparent: true,

        depthWrite: false,

        blending:
            THREE.AdditiveBlending,

        uniforms: {

            uTime: {
                value: 0
            },

            uRotation: {
                value: 0
            },

            uTilt: {
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
            attribute float aSize;
            attribute vec3 color;

            varying vec3 vColor;

            uniform float uTime;
            uniform float uRotation;
            uniform float uTilt;
            uniform float uBlackHole;
            uniform float uExpand;
            uniform float uFreeze;

            void main() {

                vec3 p = position;

                // ------------------------------------------------
                // DIFFERENTIAL GALAXY ROTATION
                // ------------------------------------------------

                float radius =
                    length(p.xz);

                float speed =
                    0.45 / (0.5 + radius * 0.08);

                float movement =
                    uTime *
                    speed *
                    (1.0 - uFreeze);

                float angle =
                    movement +
                    uRotation *
                    1.4;

                float c =
                    cos(angle);

                float s =
                    sin(angle);

                p.xz =
                    mat2(c, -s, s, c) *
                    p.xz;

                // ------------------------------------------------
                // EXPANSION
                // ------------------------------------------------

                float expansion =
                    1.0 +
                    uExpand * 0.9;

                p.xz *= expansion;

                // ------------------------------------------------
                // BLACK HOLE
                // ------------------------------------------------

                float dist =
                    length(p.xz);

                float pull =
                    uBlackHole *
                    smoothstep(
                        16.0,
                        0.0,
                        dist
                    );

                p.xz *=
                    1.0 - pull * 0.75;

                p.y +=
                    sin(dist * 0.8 + uTime)
                    * pull
                    * 1.5;

                // ------------------------------------------------
                // TILT
                // ------------------------------------------------

                float tilt =
                    uTilt * 0.7;

                float ct =
                    cos(tilt);

                float st =
                    sin(tilt);

                float newY =
                    p.y * ct -
                    p.z * st;

                float newZ =
                    p.y * st +
                    p.z * ct;

                p.y = newY;
                p.z = newZ;

                // ------------------------------------------------
                // POSITION
                // ------------------------------------------------

                vec4 mvPosition =
                    modelViewMatrix *
                    vec4(p, 1.0);

                gl_Position =
                    projectionMatrix *
                    mvPosition;

                // ------------------------------------------------
                // PARTICLE SIZE
                // ------------------------------------------------

                gl_PointSize =
                    aSize *
                    (80.0 / -mvPosition.z);

                gl_PointSize =
                    clamp(
                        gl_PointSize,
                        1.0,
                        8.0
                    );

                vColor =
                    color;
            }
        `,

        fragmentShader: `
            varying vec3 vColor;

            void main() {

                vec2 uv =
                    gl_PointCoord -
                    vec2(0.5);

                float d =
                    length(uv);

                if (d > 0.5)
                    discard;

                float glow =
                    1.0 -
                    smoothstep(
                        0.0,
                        0.5,
                        d
                    );

                gl_FragColor =
                    vec4(
                        vColor,
                        glow
                    );
            }
        `
    });


// ============================================================
// GALAXY
// ============================================================

const galaxy =
    new THREE.Points(
        geometry,
        material
    );

scene.add(galaxy);


// ============================================================
// WEBSOCKET
// ============================================================

let hand = {
    hands: 0,

    left: {
        x: 0.5,
        y: 0.5,
        pinch: 0,
        fist: 0,
        open: 0
    },

    right: {
        x: 0.5,
        y: 0.5,
        pinch: 0,
        fist: 0,
        open: 0
    },

    two_hand_distance: 0,

    rotate: 0,
    tilt: 0,
    black_hole: 0,
    freeze: 0,
    expand: 0
};


function connectWebSocket() {

    const socket =
        new WebSocket(
            "ws://localhost:8765"
        );

    socket.onopen = () => {

        console.log(
            "Connected to Python Hand Tracker."
        );

        setStatus(
            "HAND TRACKING CONNECTED"
        );
    };

    socket.onmessage = (event) => {

        try {

            hand =
                JSON.parse(
                    event.data
                );

        } catch (error) {

            console.error(
                "Invalid hand data:",
                error
            );
        }
    };

    socket.onclose = () => {

        console.log(
            "Python connection closed."
        );

        setStatus(
            "WAITING FOR PYTHON..."
        );

        setTimeout(
            connectWebSocket,
            1500
        );
    };

    socket.onerror = () => {

        setStatus(
            "PYTHON SERVER NOT FOUND"
        );
    };
}


// ============================================================
// UI
// ============================================================

function setStatus(text) {

    const element =
        document.getElementById(
            "status"
        );

    if (element) {

        element.textContent =
            text;
    }
}

connectWebSocket();


// ============================================================
// ANIMATION
// ============================================================

const clock =
    new THREE.Clock();

function animate() {

    requestAnimationFrame(
        animate
    );

    const elapsed =
        clock.getElapsedTime();

    // --------------------------------------------------------
    // SMOOTH HAND VALUES
    // --------------------------------------------------------

    const targetRotation =
        hand.rotate * 1.5;

    const targetTilt =
        hand.tilt;

    const targetBlackHole =
        hand.black_hole;

    const targetExpand =
        hand.expand;

    material.uniforms.uTime.value =
        elapsed;

    material.uniforms.uRotation.value =
        THREE.MathUtils.lerp(
            material.uniforms.uRotation.value,
            targetRotation,
            0.08
        );

    material.uniforms.uTilt.value =
        THREE.MathUtils.lerp(
            material.uniforms.uTilt.value,
            targetTilt,
            0.08
        );

    material.uniforms.uBlackHole.value =
        THREE.MathUtils.lerp(
            material.uniforms.uBlackHole.value,
            targetBlackHole,
            0.10
        );

    material.uniforms.uExpand.value =
        THREE.MathUtils.lerp(
            material.uniforms.uExpand.value,
            targetExpand,
            0.08
        );

    material.uniforms.uFreeze.value =
        THREE.MathUtils.lerp(
            material.uniforms.uFreeze.value,
            hand.freeze,
            0.15
        );

    renderer.render(
        scene,
        camera
    );
}

animate();


// ============================================================
// RESIZE
// ============================================================

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