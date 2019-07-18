class Skybox extends THREE.Group{
	constructor(imagePrefix, width = 5000, imageSuffix = ".png", sbDirections = ["X+", "X-", "Y+", "Y-", "Z+", "Z-"]){
		super();

		let sbw = width;
		let material = new THREE.MeshBasicMaterial({map: THREE.ImageUtils.loadTexture(imagePrefix + sbDirections[0] + imageSuffix), opacity: 0.03, transparent: true});

		// THREE.TextureLoader( imagePrefix + sbDirections[3] + imageSuffix )
		let sbtop = new THREE.Mesh(new THREE.PlaneGeometry(sbw,sbw), material);
		sbtop.position.y = sbw / 2; sbtop.rotation.x = Math.PI / 2;
		this.add(sbtop);
		let sbbottom = new THREE.Mesh(new THREE.PlaneGeometry(sbw,sbw), material);
		sbbottom.position.y = -sbw / 2; sbbottom.rotation.x = -Math.PI / 2;
		this.add(sbbottom);
		let sbxp = new THREE.Mesh(new THREE.PlaneGeometry(sbw,sbw), material);
		sbxp.position.x = sbw / 2; sbxp.rotation.y = -Math.PI / 2;
		this.add(sbxp);
		let sbxn = new THREE.Mesh(new THREE.PlaneGeometry(sbw,sbw), material);
		sbxn.position.x = -sbw / 2; sbxn.rotation.y = Math.PI / 2;
		this.add(sbxn);
		let sbzp = new THREE.Mesh(new THREE.PlaneGeometry(sbw,sbw), material);
		sbzp.position.z = sbw / 2; sbzp.rotation.y = Math.PI;
		this.add(sbzp);
		let sbzn = new THREE.Mesh(new THREE.PlaneGeometry(sbw,sbw), material);
		sbzn.position.z = -sbw / 2; sbzn.rotation.x = 0;
		this.add(sbzn);
	}
}