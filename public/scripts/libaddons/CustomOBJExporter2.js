THREE.ExportObj = function(scene){
	var output = "";
	var allMeshes = [];
	var indexVertex = 0;
	var indexVertexUvs = 0;
	var indexNormals = 0;
	var rnd = x => Math.round(x * 1000) / 1000;

	scene.traverse( function ( child ) {

		if ( child instanceof THREE.Mesh ) {
			allMeshes.push(child);
		}
		else if ( child instanceof THREE.Line ) {
			throw "Lines are not supported.";
		}
		else if ( child instanceof THREE.Scene ) {} // Ignore.
		else if ( child instanceof THREE.Light ) {} // Ignore.
		else{
			throw console.error("Unknown child object is currently not supported.", child);
		}
	} );

	for(var m = 0; m < allMeshes.length; m++){
		var mesh = allMeshes[m];
		var geometry = mesh.geometry;
		if ( geometry instanceof THREE.Geometry ) {
			geometry = new THREE.BufferGeometry().setFromObject( mesh );
		}

		var nbVertex = 0;
		var nbVertexUvs = 0;
		var nbNormals = 0;

		if( geometry instanceof THREE.BufferGeometry ){
			output += "g " + geometry.name + "\n";

			// name of the mesh material
			if ( mesh.material && mesh.material.name ) {
				output += "usemtl " + mesh.material.name + "\n";
			}

			var vertices = geometry.getAttribute( "position" );
			var normals = geometry.getAttribute( "normal" );
			var uvs = geometry.getAttribute( "uv" );
			var indices = geometry.getIndex();

			// Vertices.
			if ( vertices !== undefined ) {
				var vertex = new THREE.Vector3();
				for ( var i = 0; i < vertices.count; i++, nbVertex++ ) {
					vertex.x = vertices.getX( i );
					vertex.y = vertices.getY( i );
					vertex.z = vertices.getZ( i );

					// transfrom the vertex to world space
					vertex.applyMatrix4( mesh.matrixWorld );

					// transform the vertex to export format
					output += "v " + rnd(vertex.x) + " " + rnd(vertex.y) + " " + rnd(vertex.z) + "\n";

				}
			}

			// UVs.
			if ( uvs !== undefined ) {
				for ( var i = 0; i < uvs.count; i++, nbVertexUvs++) {

					var x = uvs.getX( i );
					var y = uvs.getY( i );

					// transform the uv to export format
					output += "vt " + rnd(x) + " " + rnd(y) + "\n";
				}
			}

			// Normals.
			if ( normals !== undefined ) {

				var normalMatrixWorld = new THREE.Matrix3();
				normalMatrixWorld.getNormalMatrix( mesh.matrixWorld );
				var normal = new THREE.Vector3();

				for ( var i = 0; i < normals.count; i++, nbNormals++) {

					normal.x = normals.getX( i );
					normal.y = normals.getY( i );
					normal.z = normals.getZ( i );

					// transfrom the normal to world space
					normal.applyMatrix3( normalMatrixWorld );

					// transform the normal to export format
					output += "vn " + rnd(normal.x) + " " + rnd(normal.y) + " " + rnd(normal.z) + "\n";
				}
			}

			// Faces.
			if ( indices !== null ) {
				throw "Indexed exporting is currently not supported."
			} 
			else {

				for ( var i = 0; i < vertices.count; i += 3 ) {
					var face = [];
					face.push("f");
					for ( j = 0; j < 3; j ++ ) {
						var k = i + j + 1;
						face.push(( indexVertex + k ) + "/" + ( uvs ? ( indexVertexUvs + k ) : "" ) + "/" + ( indexNormals + k ));
					}
					output += face.join( " " ) + "\n";
				}
			}
		}
		else{
			throw "Geometry type not supported.";
		}

		// update index
		indexVertex += nbVertex;
		indexVertexUvs += nbVertexUvs;
		indexNormals += nbNormals;
	}

	return output;
}