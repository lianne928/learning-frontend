import Matter from "matter-js";

let area = document.querySelector("#hero");

// engine
let engine = Matter.Engine.create();

// render
let render = Matter.Render.create({
  element: area,
  engine: engine,
  options: {
    width: area.clientWidth,
    height: 680,
    wireframes: false,
    background: "transparent",
  },
});

// object
let cloud = Matter.Body.create({
  parts: [
    Matter.Bodies.circle(260, 120, 75, { render: { fillStyle: "#FF52D9" } }),
    Matter.Bodies.circle(345, 95, 95, { render: { fillStyle: "#FF52D9" } }),
    Matter.Bodies.circle(440, 120, 80, { render: { fillStyle: "#FF52D9" } }),
    Matter.Bodies.circle(360, 170, 70, { render: { fillStyle: "#FF52D9" } }),
  ],
  restitution: 0.5,
  frictionAir: 0.03,
});

let peanut = Matter.Body.create({
  parts: [
    Matter.Bodies.circle(500, 120, 85, { render: { fillStyle: "#ffcc33" } }),
    Matter.Bodies.circle(610, 180, 85, { render: { fillStyle: "#ffcc33" } }),
    Matter.Bodies.circle(710, 240, 45, { render: { fillStyle: "#ffcc33" } }),
    Matter.Bodies.circle(750, 160, 85, { render: { fillStyle: "#ffcc33" } }),
  ],
  restitution: 0.7,
  frictionAir: 0.025,
});

let gourd = Matter.Body.create({
  parts: [
    Matter.Bodies.circle(180, 380, 80, { render: { fillStyle: "#ff6b6b" } }),
    Matter.Bodies.circle(180, 510, 100, { render: { fillStyle: "#ff6b6b" } }),
  ],
  restitution: 0.6,
  frictionAir: 0.025,
});

let snowman = Matter.Body.create({
  parts: [
    Matter.Bodies.circle(600, 150, 55, { render: { fillStyle: "#a78bfa" } }),
    Matter.Bodies.circle(600, 235, 70, { render: { fillStyle: "#a78bfa" } }),
    Matter.Bodies.circle(600, 340, 90, { render: { fillStyle: "#a78bfa" } }),
  ],
  restitution: 0.5,
  frictionAir: 0.03,
});

let clover = Matter.Body.create({
  parts: [
    Matter.Bodies.circle(700, 480, 65, { render: { fillStyle: "#f43f5e" } }),
    Matter.Bodies.circle(830, 480, 65, { render: { fillStyle: "#f43f5e" } }),
    Matter.Bodies.circle(765, 415, 65, { render: { fillStyle: "#f43f5e" } }),
    Matter.Bodies.circle(765, 545, 65, { render: { fillStyle: "#f43f5e" } }),
  ],
  restitution: 0.55,
  frictionAir: 0.025,
});
// 星形（寶藍色，六圓環繞中心緊密重疊）
let star = Matter.Body.create({
  parts: [
    Matter.Bodies.circle(300, 300, 60, { render: { fillStyle: "#3b82f6" } }),
    Matter.Bodies.circle(390, 300, 60, { render: { fillStyle: "#3b82f6" } }),
    Matter.Bodies.circle(255, 365, 60, { render: { fillStyle: "#3b82f6" } }),
    Matter.Bodies.circle(435, 365, 60, { render: { fillStyle: "#3b82f6" } }),
    Matter.Bodies.circle(300, 430, 60, { render: { fillStyle: "#3b82f6" } }),
    Matter.Bodies.circle(390, 430, 60, { render: { fillStyle: "#3b82f6" } }),
    Matter.Bodies.circle(345, 345, 70, { render: { fillStyle: "#3b82f6" } }),
  ],
  restitution: 0.55,
  frictionAir: 0.025,
});

// 梅花（天藍色，五圓緊密環繞中心）
let plum = Matter.Body.create({
  parts: [
    Matter.Bodies.circle(650, 365, 65, { render: { fillStyle: "#38bdf8" } }),
    Matter.Bodies.circle(650, 235, 65, { render: { fillStyle: "#38bdf8" } }),
    Matter.Bodies.circle(538, 300, 65, { render: { fillStyle: "#38bdf8" } }),
    Matter.Bodies.circle(762, 300, 65, { render: { fillStyle: "#38bdf8" } }),
    Matter.Bodies.circle(595, 430, 65, { render: { fillStyle: "#38bdf8" } }),
    Matter.Bodies.circle(705, 430, 65, { render: { fillStyle: "#38bdf8" } }),
    Matter.Bodies.circle(650, 320, 75, { render: { fillStyle: "#38bdf8" } }),
  ],
  restitution: 0.6,
  frictionAir: 0.02,
});

// 花形）
let flower = Matter.Body.create({
  parts: [
    Matter.Bodies.circle(345, 230, 52, { render: { fillStyle: "#a7f0d1" } }),
    Matter.Bodies.circle(345, 370, 52, { render: { fillStyle: "#a7f0d1" } }),
    Matter.Bodies.circle(275, 300, 52, { render: { fillStyle: "#a7f0d1" } }),
    Matter.Bodies.circle(415, 300, 52, { render: { fillStyle: "#a7f0d1" } }),
    Matter.Bodies.circle(297, 252, 52, { render: { fillStyle: "#a7f0d1" } }),
    Matter.Bodies.circle(393, 252, 52, { render: { fillStyle: "#a7f0d1" } }),
    Matter.Bodies.circle(297, 348, 52, { render: { fillStyle: "#a7f0d1" } }),
    Matter.Bodies.circle(393, 348, 52, { render: { fillStyle: "#a7f0d1" } }),
    Matter.Bodies.circle(345, 300, 75, { render: { fillStyle: "#a7f0d1" } }),
  ],
  restitution: 0.55,
  frictionAir: 0.025,
});

// 米字形
let asterisk = Matter.Body.create({
  parts: [
    Matter.Bodies.rectangle(700, 300, 160, 42, {
      render: { fillStyle: "#c8f535" },
    }),
    Matter.Bodies.rectangle(700, 300, 160, 42, {
      angle: Math.PI / 4,
      render: { fillStyle: "#c8f535" },
    }),
    Matter.Bodies.rectangle(700, 300, 160, 42, {
      angle: Math.PI / 2,
      render: { fillStyle: "#c8f535" },
    }),
    Matter.Bodies.rectangle(700, 300, 160, 42, {
      angle: -Math.PI / 4,
      render: { fillStyle: "#c8f535" },
    }),
  ],
  restitution: 0.6,
  frictionAir: 0.025,
});

// 牆壁與地板
let floor = Matter.Bodies.rectangle(
  area.clientWidth / 2,
  780,
  area.clientWidth + 400,
  200,
  {
    isStatic: true,
    render: { fillStyle: "transparent" },
  },
);

let leftWall = Matter.Bodies.rectangle(-100, 340, 200, 1400, {
  isStatic: true,
  render: { fillStyle: "transparent" },
});

let rightWall = Matter.Bodies.rectangle(
  area.clientWidth + 100,
  340,
  200,
  1400,
  {
    isStatic: true,
    render: { fillStyle: "transparent" },
  },
);

let top = Matter.Bodies.rectangle(
  area.clientWidth / 2,
  -100,
  area.clientWidth + 400,
  200,
  {
    isStatic: true,
    render: { fillStyle: "transparent" },
  },
);

let mouse = Matter.Mouse.create(render.canvas);

let mouseConstraint = Matter.MouseConstraint.create(engine, {
  mouse: mouse,
  constraint: {
    stiffness: 0.2,
    render: { visible: false },
  },
});

Matter.World.add(engine.world, [
  cloud,
  peanut,
  star,
  gourd,
  // snowman,
  asterisk,
  clover,
  // plum,
  leftWall,
  rightWall,
  top,
  floor,
  mouseConstraint,
  flower,
]);

// 防止圖形高速穿牆，每幀檢查位置並強制拉回
Matter.Events.on(engine, "beforeUpdate", function () {
  const allBodies = [
    cloud,
    peanut,
    star,
    gourd,
    snowman,
    asterisk,
    clover,
    plum,
    flower,
  ];
  const margin = 80;

  allBodies.forEach((body) => {
    const pos = body.position;
    const vx = body.velocity.x;
    const vy = body.velocity.y;

    if (pos.x < margin) {
      Matter.Body.setPosition(body, { x: margin, y: pos.y });
      Matter.Body.setVelocity(body, { x: Math.abs(vx) * 0.5, y: vy });
    }
    if (pos.x > area.clientWidth - margin) {
      Matter.Body.setPosition(body, { x: area.clientWidth - margin, y: pos.y });
      Matter.Body.setVelocity(body, { x: -Math.abs(vx) * 0.5, y: vy });
    }
    if (pos.y < margin) {
      Matter.Body.setPosition(body, { x: pos.x, y: margin });
      Matter.Body.setVelocity(body, { x: vx, y: Math.abs(vy) * 0.5 });
    }
    if (pos.y > 680 - margin) {
      Matter.Body.setPosition(body, { x: pos.x, y: 680 - margin });
      Matter.Body.setVelocity(body, { x: vx, y: -Math.abs(vy) * 0.5 });
    }
  });
});

// run
Matter.Render.run(render);
const runner = Matter.Runner.create();
Matter.Runner.run(runner, engine);
