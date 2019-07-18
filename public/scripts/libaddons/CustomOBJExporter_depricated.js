/**
 * @author mrdoob / http://mrdoob.com/
 */

THREE.OBJExporter = function () {};

THREE.OBJExporter.prototype = {

	constructor: THREE.OBJExporter,

	parse: function ( object, progress ) {

		var output = "";

		var indexVertex = 0;
		var indexVertexUvs = 0;
		var indexNormals = 0;

		var vertex = new THREE.Vector3();
		var normal = new THREE.Vector3();
		var uv = new THREE.Vector2();

		var i, j, k, l, m, face = [];

		var parseMesh = function ( mesh, progress ) {

			var nbVertex = 0;
			var nbNormals = 0;
			var nbVertexUvs = 0;
			var normalMatrixWorld = new THREE.Matrix3();

			
			
			var geometry = mesh.geometry;
			if ( geometry instanceof THREE.Geometry ) {
				geometry = new THREE.BufferGeometry().setFromObject( mesh );
				geometry.name = mesh.geometry.name;
			}



			if ( geometry instanceof THREE.BufferGeometry ) {
				// shortcuts
				var vertices = geometry.getAttribute( "position" );
				var normals = geometry.getAttribute( "normal" );
				var uvs = geometry.getAttribute( "uv" );
				var indices = geometry.getIndex();

				// name of the mesh object
				output += "g " + geometry.name + "\n";

				// name of the mesh material
				if ( mesh.material && mesh.material.name ) {
					output += "usemtl " + mesh.material.name + "\n";
				}


				if(progress) progress(0);
				return Sequencr.promiseChain([
					resolve => {
						// vertices

						if ( vertices !== undefined ) {

							for ( i = 0, l = vertices.count; i < l; i ++, nbVertex ++ ) {

								vertex.x = vertices.getX( i );
								vertex.y = vertices.getY( i );
								vertex.z = vertices.getZ( i );

								// transfrom the vertex to world space
								vertex.applyMatrix4( mesh.matrixWorld );

								// transform the vertex to export format
								output += "v " + vertex.x + " " + vertex.y + " " + vertex.z + "\n";

							}
							if(progress) progress(9/27);
						}
						resolve();
					}, resolve => {

						// uvs

						if ( uvs !== undefined ) {

							for ( i = 0, l = uvs.count; i < l; i ++, nbVertexUvs ++ ) {

								uv.x = uvs.getX( i );
								uv.y = uvs.getY( i );

								// transform the uv to export format
								output += "vt " + uv.x + " " + uv.y + "\n";

							}

						}
						if(progress) progress(15/27);
						resolve();
					},
					resolve => {

						// normals

						if ( normals !== undefined ) {

							normalMatrixWorld.getNormalMatrix( mesh.matrixWorld );

							for ( i = 0, l = normals.count; i < l; i ++, nbNormals ++ ) {

								normal.x = normals.getX( i );
								normal.y = normals.getY( i );
								normal.z = normals.getZ( i );

								// transfrom the normal to world space
								normal.applyMatrix3( normalMatrixWorld );

								// transform the normal to export format
								output += "vn " + normal.x + " " + normal.y + " " + normal.z + "\n";

							}

						}
						if(progress) progress(18/27);
						resolve();
					}, resolve => {

						// faces
						var allGroups = [];
						if ( indices !== null ) {
							throw "Indexed exporting is currently not supported."
							for ( i = 0, l = indices.count; i < l; i += 3 ) {

								for ( m = 0; m < 3; m ++ ) {

									j = indices.getX( i + m ) + 1;

									face[ m ] = ( indexVertex + j ) + "/" + ( uvs ? ( indexVertexUvs + j ) : "" ) + "/" + ( indexNormals + j );

								}
								
								// transform the face to export format
								var g = mesh.geometry.faces[i / 3].materialIndex;
								if(!allGroups[g]) allGroups[g] = "g g" + g + "\n"
								allGroups[g] += "f " + face.join( " " ) + "\n";

							}

						} else {

							for ( i = 0, l = vertices.count; i < l; i += 3 ) {
								//let v = i / 3;
								for ( m = 0; m < 3; m ++ ) {

									j = i + m + 1;
									face[ m ] = ( indexVertex + j ) + "/" + ( uvs ? ( indexVertexUvs + j ) : "" ) + "/" + ( indexNormals + j );

								}
								// transform the face to export format
								//console.log(mesh);
								var g = mesh.geometry.groups.findIndex((value,index)=>{
									return i >= value.start && i < value.start + value.count;
								});
								//[i / 3].materialIndex;
								if(!allGroups[g]) allGroups[g] = "g g" + g + "\n"
								allGroups[g] += "f " + face.join( " " ) + "\n";

							}

						}
						for(var i = 0; i < allGroups.length; i++) output += allGroups[i] || "";
						if(progress) progress(1);
						resolve();
					}, resolve => {

						// update index
						indexVertex += nbVertex;
						indexVertexUvs += nbVertexUvs;
						indexNormals += nbNormals;
						resolve(output);
					}
				]);
			} else {

				console.warn( "THREE.OBJExporter.parseMesh(): geometry type unsupported", geometry );
				reject();
			}


		};

		var parseLine = function ( line ) {
			throw "Not used.";

			var nbVertex = 0;

			var geometry = line.geometry;
			var type = line.type;

			if ( geometry instanceof THREE.Geometry ) {

				geometry = new THREE.BufferGeometry().setFromObject( line );

			}

			if ( geometry instanceof THREE.BufferGeometry ) {

				// shortcuts
				var vertices = geometry.getAttribute( "position" );

				// name of the line object
				output += "o " + line.name + "\n";

				if ( vertices !== undefined ) {

					for ( i = 0, l = vertices.count; i < l; i ++, nbVertex ++ ) {

						vertex.x = vertices.getX( i );
						vertex.y = vertices.getY( i );
						vertex.z = vertices.getZ( i );

						// transfrom the vertex to world space
						vertex.applyMatrix4( line.matrixWorld );

						// transform the vertex to export format
						output += "v " + vertex.x + " " + vertex.y + " " + vertex.z + "\n";

					}

				}

				if ( type === "Line" ) {

					output += "l ";

					for ( j = 1, l = vertices.count; j <= l; j ++ ) {

						output += ( indexVertex + j ) + " ";

					}

					output += "\n";

				}

				if ( type === "LineSegments" ) {

					for ( j = 1, k = j + 1, l = vertices.count; j < l; j += 2, k = j + 1 ) {

						output += "l " + ( indexVertex + j ) + " " + ( indexVertex + k ) + "\n";

					}

				}

			} else {

				console.warn( "THREE.OBJExporter.parseLine(): geometry type unsupported", geometry );

			}

			// update index
			indexVertex += nbVertex;

		};
		
		let allChildren = [];
		object.traverse( function ( child ) {

			if ( child instanceof THREE.Mesh ) {
				allChildren.push(child);
			}

			if ( child instanceof THREE.Line ) {
				console.error("Lines are not supported.");
				//parseLine( child );

			}

		} );

		
		return Sequencr.promiseFor(0, allChildren.length, (resolve, reject, i) => {
			parseMesh( allChildren[i], progress ).then(r => resolve(r));
		});/*.then(()=>{
			resolve(output);
		}).catch((reason) => {
			reject(reason);
		});*/

		//return output;

	}

};
