import * as THREE from 'https://cdn.skypack.dev/three@0.136.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/controls/OrbitControls.js';
import { WEBGL } from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/WebGL.js';
import { GUI } from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/libs/lil-gui.module.min.js';

// Declaring objects within the scene
var camera, controls, scene, renderer, videoElement, canvasElement, canvasCtx, gui;

var WIDTH = 1940, HEIGHT = 1080;

// Image and Video Textures
var imageProcessing, imageProcessingMaterial;

// Face Mesh
var faceMesh, webcam;
var LeftEye_Vertices = [], RightEye_Vertices = [],
	LeftIris_Vertices = [], RightIris_Vertices = [], 
	LeftEyebrow_Vertices = [], RightEyebrow_Vertices = [],
	Lips_Vertices = [], Face_Vertices = [];

init();
animate();

// Loaded Image or Frames Processing Function
function IVimageProcessing (imageProcessingMaterial, width, height){
    //3 rtt setup
    const scene = new THREE.Scene();
    const orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1/Math.pow( 2, 53 ), 1);

    //4 create a target texture
    var options = {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        format: THREE.RGBAFormat,
        type:THREE.FloatType, //type:THREE.UnsignedByteType,
    };
    const rtt = new THREE.WebGLRenderTarget( width, height, options);

    var geom = new THREE.BufferGeometry();
    geom.setAttribute( 'position', new THREE.BufferAttribute( new Float32Array([-1,-1,0, 1,-1,0, 1,1,0, -1,-1, 0, 1, 1, 0, -1,1,0 ]), 3 ) );
    scene.add(new THREE.Mesh(geom, imageProcessingMaterial));

    return {height, width, scene, orthoCamera, rtt}
}

function image_Processing(){
	imageProcessingMaterial = new THREE.RawShaderMaterial({
    	uniforms: {
    	    type: {type: 'i', value: 0},
        	image: {type: 't', value: null},

			show_env:{type: "b", value: true},

			RightEye_Vertices: {value: RightEye_Vertices},
			LeftEye_Vertices: {value: LeftEye_Vertices},

			RightIris_Vertices: {value: RightIris_Vertices},
			LeftIris_Vertices: {value: LeftIris_Vertices},

			LeftEyebrow_Vertices: {value: LeftEyebrow_Vertices},
			RightEyebrow_Vertices: {value: RightEyebrow_Vertices},

			Lips_Vertices: {value: Lips_Vertices},
			Face_Vertices: {value: Face_Vertices},
    	},
		defines: {
			MAX_SIZE_EYE: 32,
			MAX_SIZE_IRIS: 8,
			MAX_SIZE_EYEBROW: 20,
			MAX_SIZE_LIPS: 88,
			MAX_SIZE_FACE: 74,

			MAX_SIZE: 100,
		},
		
    	vertexShader: document.getElementById('vertShader').text,
    	fragmentShader: document.getElementById('fragShader').text,
        glslVersion: THREE.GLSL3
	});
	
	imageProcessing = new IVimageProcessing (imageProcessingMaterial, WIDTH, HEIGHT);

	var geometry = new THREE.PlaneGeometry( 1, HEIGHT/WIDTH );
	var material = new THREE.MeshBasicMaterial( { map: imageProcessing.rtt.texture, side : THREE.DoubleSide } );
	const processed_image = new THREE.Mesh( geometry, material );
	processed_image.receiveShadow = false;
	processed_image.castShadow = false;
    scene.add(processed_image);
}

function get_Meshes(landmarks, STRUCTURE){
	let i = 0, Vertices = [];
	for(; i < STRUCTURE.length; i++){
		Vertices.push(landmarks[STRUCTURE[i][0]].x * WIDTH);
		Vertices.push((1 - landmarks[STRUCTURE[i][0]].y) * HEIGHT);
	}
	Vertices.push((landmarks[STRUCTURE[STRUCTURE.length - 1][1]].x) * WIDTH);
	Vertices.push((1 - landmarks[STRUCTURE[STRUCTURE.length - 1][1]].y) * HEIGHT);
	return Vertices;
}


function get_Mesh_Vertices(landmarks, list){
	var i = 0, Vertices = [];
	for(; i < list.length; i++){
		Vertices.push(landmarks[list[i]].x * WIDTH);
		Vertices.push((1 - landmarks[list[i]].y) * HEIGHT);
	}	
	return Vertices;
}

// Face Mesh Prediction and Webcam
const LIP_MESH = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95, 78,
					61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 308, 415, 310, 311, 312, 13, 82, 81, 80, 191, 78
					];

const RIGHTEYE_MESH = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
const LEFTEYE_MESH = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];

const RIGHTEYEBROW_MESH = [46, 53, 52, 65, 55, 107, 66, 105, 63, 70];
const LEFTEYEBROW_MESH = [285, 295, 282, 283, 276, 300, 293, 334, 296, 336];

const RIGHTIRIS_MESH = [469, 470, 471, 472];
const LEFTIRIS_MESH = [474, 475, 476, 477];


function get_iris_Vertices(Vertices){
	var newVertices = [];
	var x = (Vertices[2] - Vertices[0]) / 2;
	var y = (Vertices[3] - Vertices[1]) / 2;
	var r = Math.sqrt(Math.pow((x - Vertices[0]), 2) + Math.pow((y - Vertices[1]), 2));

	for(var theta = 0; theta < 360; theta += 6){
		newVertices.push(r * Math.cos(theta * Math.PI / 180));
		newVertices.push(r * Math.sin(theta *Math.PI / 180));
	}
	return newVertices;
}


function onResults(results) {
	canvasCtx.save();
	canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
	canvasCtx.drawImage(
		results.image, 0, 0, canvasElement.width, canvasElement.height);
	if (results.multiFaceLandmarks) {
	  for (const landmarks of results.multiFaceLandmarks) {
		
		RightEye_Vertices = get_Mesh_Vertices(landmarks, RIGHTEYE_MESH);
		LeftEye_Vertices = get_Mesh_Vertices(landmarks, LEFTEYE_MESH);

		// var right = get_iris_Vertices(get_Mesh_Vertices(landmarks, RIGHTIRIS_MESH));
		// RightIris_Vertices = get_iris_Vertices(get_Mesh_Vertices(landmarks, RIGHTIRIS_MESH));
		// LeftIris_Vertices = get_iris_Vertices(get_Mesh_Vertices(landmarks, LEFTIRIS_MESH));
		
		RightIris_Vertices = get_Mesh_Vertices(landmarks, RIGHTIRIS_MESH);
		LeftIris_Vertices = get_Mesh_Vertices(landmarks, LEFTIRIS_MESH);

		LeftEyebrow_Vertices = get_Mesh_Vertices(landmarks, LEFTEYEBROW_MESH);
		RightEyebrow_Vertices = get_Mesh_Vertices(landmarks, RIGHTEYEBROW_MESH);

		Lips_Vertices = get_Mesh_Vertices(landmarks, LIP_MESH);
		Face_Vertices = get_Meshes(landmarks, FACEMESH_FACE_OVAL);

		//console.log(FACEMESH_LEFT_IRIS);
		// TODO: FACEMESH_TESSELATION - For smiling or different colors in different triangles

	  }
	}
	canvasCtx.restore();

	const texture = new THREE.CanvasTexture(canvasCtx.canvas);

	texture.minFilter = THREE.NearestFilter;
	texture.magFilter = THREE.NearestFilter;
	texture.generateMipmaps = false; 
	texture.format = THREE.RGBFormat;

	imageProcessingMaterial.uniforms.image.value = texture;

	imageProcessingMaterial.uniforms.RightEye_Vertices.value = RightEye_Vertices;
	imageProcessingMaterial.uniforms.LeftEye_Vertices.value = LeftEye_Vertices;

	imageProcessingMaterial.uniforms.RightIris_Vertices.value = RightIris_Vertices;
	imageProcessingMaterial.uniforms.LeftIris_Vertices.value = LeftIris_Vertices;

	imageProcessingMaterial.uniforms.RightIris_Vertices.value = RightIris_Vertices;
	imageProcessingMaterial.uniforms.LeftIris_Vertices.value = LeftIris_Vertices;

	imageProcessingMaterial.uniforms.RightEyebrow_Vertices.value = RightEyebrow_Vertices;
	imageProcessingMaterial.uniforms.LeftEyebrow_Vertices.value = LeftEyebrow_Vertices;

	imageProcessingMaterial.uniforms.Lips_Vertices.value = Lips_Vertices;
	imageProcessingMaterial.uniforms.Face_Vertices.value = Face_Vertices;

}

function face_Mesh(){
	faceMesh = new FaceMesh({locateFile: (file) => {
		return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
	}});
	faceMesh.setOptions({
		maxNumFaces: 1,
		refineLandmarks: true,
		minDetectionConfidence: 0.5,
		minTrackingConfidence: 0.5
	});
	faceMesh.onResults(onResults);
	
	webcam = new Camera(videoElement, {
		onFrame: async () => {
			await faceMesh.send({image: videoElement});
		},
		width: WIDTH,
		height: HEIGHT
	});
	webcam.start();
}

// Initialization Function
function init () {
    if ( WEBGL.isWebGL2Available() === false ) {
		document.body.appendChild( WEBGL.getWebGL2ErrorMessage() );
	}
    const container = document.createElement( 'div' );
	document.body.appendChild( container );

	videoElement = document.createElement( 'video' );
	canvasElement = document.createElement( 'canvas' );
	canvasElement.width = WIDTH; canvasElement.height = HEIGHT; 

	canvasCtx = canvasElement.getContext('2d');
	// document.body.appendChild( canvasElement );

	// Renderer
	const canvas = document.createElement( 'canvas' );
	const context = canvas.getContext( 'webgl2' );
	document.body.appendChild( canvas );

	renderer = new THREE.WebGLRenderer( {  canvas: canvas, context: context});
    renderer.autoClear = false;
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.shadowMap.enabled = false;

	// Scene
	scene = new THREE.Scene(); 

	// Camera
	camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.001, 10 );
	camera.position.z = 2;

	// Controls
	controls = new OrbitControls( camera, renderer.domElement );
	controls.minDistance = 0.005;
	controls.maxDistance = 1.0;
	controls.enableRotate = true;
	controls.addEventListener( 'change', render );
	controls.update();

	// Facemesh
	face_Mesh();

	// Image Processing
	image_Processing();

	//GUI
	const parameters = {
		model: 0,
		env: true,
	};

	function update() {
		imageProcessingMaterial.uniforms.type.value = parameters.model;
		imageProcessingMaterial.uniforms.show_env.value = parameters.env;

	}
	
	gui = new GUI();
	gui.add(parameters, 'model', { "Clown": 0, "Blue": 1, "Alien": 2}).onChange( update );
	gui.add(parameters, 'env').name("Environment").onChange( update );;

	window.addEventListener( 'resize', onWindowResize, false );
}

// Rendering Function
function render () {
	renderer.clear();
	if (typeof imageProcessing !== 'undefined'){
		renderer.setRenderTarget( imageProcessing.rtt );
		renderer.render ( imageProcessing.scene, imageProcessing.orthoCamera ); 	
		renderer.setRenderTarget( null );
	}
	renderer.render( scene, camera );
}

function animate() {
	requestAnimationFrame(animate);
	controls.update();
	render();
}

function onWindowResize () {
	camera.aspect = ( window.innerWidth / window.innerHeight);
	camera.updateProjectionMatrix();
	renderer.setSize( window.innerWidth, window.innerHeight );
	render();
}
