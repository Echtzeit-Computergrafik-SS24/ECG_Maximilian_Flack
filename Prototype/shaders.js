export {skyboxVSSource, skyboxFSSource, groundInstanceVSSource, groundVSSource, trackFSSource, groundFSSource, worldinstanceVSSource, trainVSSource, trainFSSource, shadowVSSource, shadowInstanceVSSource, shadowFSSource, postVSSource, postFSSource};
// =====================================================================
// Shader Code
// =====================================================================

// skybox shaders ////////////////////////////////////////////
const skyboxVSSource = `#version 300 es
    precision highp float;

    uniform mat4 u_viewMatrix;
    uniform mat4 u_projectionMatrix;

    in vec3 a_pos;

    out vec3 f_texCoord;

    void main() {
        f_texCoord = a_pos;
        vec4 ndcPos = u_projectionMatrix * u_viewMatrix * vec4(a_pos, 0.0);
        gl_Position = ndcPos.xyww;
    }
`;
const skyboxFSSource = `#version 300 es
    precision mediump float;

    uniform samplerCube u_skybox;

    in vec3 f_texCoord;

    out vec4 o_fragColor;

    void main() {
        o_fragColor = texture(u_skybox, f_texCoord);
    }
`;

// world shaders ////////////////////////////////////////////
const groundInstanceVSSource = `#version 300 es
    precision highp float;

    uniform mat4 u_viewMatrix;
    uniform mat4 u_projectionMatrix;
    uniform vec3 u_viewPos;
    uniform mat4 u_lightProjection;
    uniform vec3 u_lightPosition;
    uniform mat4 u_lightXform;
    uniform vec3 u_groundArr[36];

    in float a_instancePos;
    in vec3 a_pos;
    in vec3 a_normal;
    in vec2 a_texCoord;
    in vec3 a_tangent;

    out vec3 f_worldPos;
    out vec3 f_viewPos;
    out vec3 f_lightPos;
    out vec2 f_texCoord;
    out vec4 f_fragPosLS;

    mat4 buildTranslation(vec3 delta) {
        const float PI_2 = 1.57079632679489661923;
        if (a_instancePos == -1.0) {
            return mat4(
                vec4(1.0, 0.0, 0.0, 0.0),
                vec4(0.0, 1.0, 0.0, 0.0),
                vec4(0.0, 0.0, 1.0, 0.0),
                vec4(0.0, 0.0, 0.0, 1.0)
            );
        }
        else {
            return mat4(
                vec4(0.8, 0.0, 0.0, 0.0),
                vec4(0.0, cos(PI_2), -sin(PI_2), 0.0),
                vec4(0.0, sin(PI_2), cos(PI_2), 0.0),
                vec4(delta, 1.0)
            );
        }
    }

    void main() {
        int id = int(a_instancePos);
        mat4 iPos = buildTranslation(u_groundArr[id]);
        
        vec3 normal = (iPos * vec4(a_normal, 0.0)).xyz;
        vec3 tangent = (iPos * vec4(a_tangent, 0.0)).xyz;
        vec3 bitangent = cross(normal, tangent);
        mat3 worldToTangent = transpose(mat3(tangent, bitangent, normal));

        vec4 worldPosition = iPos * vec4(a_pos, 1.0);
        
        // Transform world space coords to tangent space
        f_worldPos = worldToTangent * worldPosition.xyz;
        f_viewPos = worldToTangent * u_viewPos;
        f_lightPos = worldToTangent * u_lightPosition;

        f_texCoord = a_texCoord;

        gl_Position = u_projectionMatrix * u_viewMatrix * worldPosition;
        f_fragPosLS = u_lightProjection * u_lightXform * worldPosition;
    }
`;
const groundVSSource = `#version 300 es
    precision highp float;

    uniform mat4 u_modelMatrix;
    uniform mat4 u_viewMatrix;
    uniform mat4 u_projectionMatrix;
    uniform vec3 u_viewPos;
    uniform mat4 u_lightProjection;
    uniform vec3 u_lightPosition;
    uniform mat4 u_lightXform;

    in vec3 a_pos;
    in vec3 a_normal;
    in vec2 a_texCoord;
    in vec3 a_tangent;

    out vec3 f_worldPos;
    out vec3 f_viewPos;
    out vec3 f_lightPos;
    out vec2 f_texCoord;
    out vec4 f_fragPosLS;

    void main() {
        vec3 normal = (u_modelMatrix * vec4(a_normal, 0.0)).xyz;
        vec3 tangent = (u_modelMatrix * vec4(a_tangent, 0.0)).xyz;
        vec3 bitangent = cross(normal, tangent);
        mat3 worldToTangent = transpose(mat3(tangent, bitangent, normal));

        vec4 worldPosition = u_modelMatrix * vec4(a_pos, 1.0);
        
        // Transform world space coords to tangent space
        f_worldPos = worldToTangent * worldPosition.xyz;
        f_viewPos = worldToTangent * u_viewPos;
        f_lightPos = worldToTangent * u_lightPosition;

        f_texCoord = a_texCoord;

        gl_Position = u_projectionMatrix * u_viewMatrix * worldPosition;
        f_fragPosLS = u_lightProjection * u_lightXform * worldPosition;
    }
`;
const trackFSSource = `#version 300 es
    precision mediump float;

    uniform float u_ambient;
    uniform float u_diffuse;
    uniform float u_specular;
    uniform float u_shininess;
    uniform vec3 u_lightColor;
    uniform sampler2D u_texDiffuse;
    uniform sampler2D u_texSpecular;
    uniform sampler2D u_texNormal;
    uniform sampler2D u_texDepth;
    uniform sampler2D u_texShadow;

    in vec3 f_worldPos;
    in vec3 f_viewPos;
    in vec3 f_lightPos;
    in vec2 f_texCoord;
    in vec4 f_fragPosLS;

    out vec4 FragColor;

    const float parallaxScale = 0.04;
    const float minLayers = 16.0;
    const float maxLayers = 64.0;

    vec2 parallax_mapping(vec3 viewDir) {
        float numLayers = mix(maxLayers, minLayers, smoothstep(0.0, 1.0, max(dot(vec3(0.0, 0.0, 1.0), viewDir), 0.0)));
        vec2 texCoordsDelta   = (viewDir.xy * parallaxScale) / (viewDir.z * numLayers);

        vec2  currentTexCoords     = f_texCoord;
        float currentDepthMapValue = 1.0 - texture(u_texDepth, currentTexCoords).r;
        float prevDepthMapValue    = currentDepthMapValue;

        float i = 0.0;
        for(;i / numLayers < currentDepthMapValue; i += 1.0)
        {
            prevDepthMapValue    = currentDepthMapValue;
            currentTexCoords    -= texCoordsDelta;
            currentDepthMapValue = 1.0 - texture(u_texDepth, currentTexCoords).r;
        }

        // get depth after and before collision for linear interpolation
        float afterDepth  = currentDepthMapValue - i / numLayers;
        float beforeDepth = prevDepthMapValue - max(i - 1.0, 0.0) / numLayers;

        float fraction = afterDepth / (afterDepth - beforeDepth);
        return currentTexCoords + (texCoordsDelta * fraction);
    }

    float calculateShadow() {
        // Perspective divide.
        vec3 projCoords = f_fragPosLS.xyz / f_fragPosLS.w;

        // Transform to [0,1] range.
        projCoords = projCoords * 0.5 + 0.5;

        // No shadow for fragments outside of the light's frustum.
        if(any(lessThan(projCoords, vec3(0))) || any(greaterThan(projCoords, vec3(1)))){
            return 1.0;
        }

        float bias = 0.002;
        float closestDepth = texture(u_texShadow, projCoords.xy).r;
        return projCoords.z - bias > closestDepth  ? 0.0 : 1.0;
    }

    void main() {
        // parallax
        vec3 viewDir = normalize(f_viewPos - f_worldPos);
        vec2 texCoord = parallax_mapping(viewDir);
        if(texCoord.x > 1.0
            || texCoord.y > 1.0
            || texCoord.x < 0.0
            || texCoord.y < 0.0) {
            discard;
        }

        // texture
        vec3 texDiffuse = texture(u_texDiffuse, texCoord).rgb;
        vec3 texSpecular = texture(u_texSpecular, texCoord).rgb;
        vec3 texNormal = texture(u_texNormal, texCoord).rgb;

        // lighting
        vec3 normal = normalize(texNormal * (255./128.) - 1.0);
        vec3 lightDir = normalize(f_lightPos - f_worldPos);
        vec3 halfWay = normalize(viewDir + lightDir);

        // ambient
        vec3 ambient = texDiffuse * u_ambient;

        // diffuse
        float diffuseIntensity = max(dot(normal, lightDir), 0.0);
        vec3 diffuse = texDiffuse * texSpecular * diffuseIntensity * u_lightColor * u_diffuse;

        // specular
        float specularIntensity = pow(max(dot(normal, halfWay), 0.0), u_shininess);
        vec3 specular = texSpecular * specularIntensity * u_lightColor * u_specular;

        // shadow
        float shadow = calculateShadow();

        // color
        vec3 endColor = vec3(ambient + shadow * (diffuse + specular));
        FragColor = vec4(endColor, 1.0);
    }
`;
const groundFSSource = `#version 300 es
    precision mediump float;

    uniform float u_ambient;
    uniform float u_diffuse;
    uniform float u_specular;
    uniform float u_shininess;
    uniform vec3 u_lightColor;
    uniform sampler2D u_texDiffuse;
    uniform sampler2D u_texSpecular;
    uniform sampler2D u_texNormal;
    uniform sampler2D u_texShadow;

    in vec3 f_worldPos;
    in vec2 f_texCoord;
    in vec3 f_lightPos;
    in vec3 f_viewPos;
    in vec4 f_fragPosLS;

    out vec4 FragColor;

    float calculateShadow() {
        // Perspective divide.
        vec3 projCoords = f_fragPosLS.xyz / f_fragPosLS.w;

        // Transform to [0,1] range.
        projCoords = projCoords * 0.5 + 0.5;

        // No shadow for fragments outside of the light's frustum.
        if(any(lessThan(projCoords, vec3(0))) || any(greaterThan(projCoords, vec3(1)))){
            return 1.0;
        }

        float bias = 0.002;
        float closestDepth = texture(u_texShadow, projCoords.xy).r;
        return projCoords.z - bias > closestDepth  ? 0.0 : 1.0;
    }

    void main() {
        // texture
        vec3 texDiffuse = texture(u_texDiffuse, f_texCoord).rgb;
        vec3 texSpecular = texture(u_texSpecular, f_texCoord).rgb;
        vec3 texNormal = texture(u_texNormal, f_texCoord).rgb;

        // lighting
        vec3 normal = normalize(texNormal * (255./128.) - 1.0);
        vec3 lightDir = normalize(f_lightPos - f_worldPos);
        vec3 viewDir = normalize(f_viewPos - f_worldPos);
        vec3 halfWay = normalize(viewDir + lightDir);

        // ambient
        vec3 ambient = texDiffuse * u_ambient;

        // diffuse
        float diffuseIntensity = max(dot(normal, lightDir), 0.0);
        vec3 diffuse = texDiffuse * diffuseIntensity * u_lightColor * u_diffuse;

        // specular
        float specularIntensity = pow(max(dot(normal, halfWay), 0.0), u_shininess);
        vec3 specular = texSpecular * specularIntensity * u_lightColor * u_specular;

        // shadow
        float shadow = calculateShadow();

        // result
        vec3 endColor = vec3(ambient + shadow * (diffuse + specular));
        FragColor = vec4(endColor, 1.0);
    }
`;
const worldinstanceVSSource = `#version 300 es
    precision highp float;

    uniform mat4 u_viewMatrix;
    uniform mat4 u_projectionMatrix;
    uniform mat4 u_lightProjection;
    uniform vec3 u_lightPosition;
    uniform mat4 u_lightXform;
    uniform vec3 u_groundArr[36];
    // type of building that is being created 1=ground, 2=tree, 3=station, 4=fueltank, 5=track
    uniform float u_type;

    in float a_instancePos;
    in vec3 a_pos;
    in vec3 a_normal;
    in vec2 a_texCoord;

    out vec3 f_normal;
    out vec3 f_worldPos;
    out vec2 f_texCoord;
    out vec3 f_lightDir;
    out vec4 f_fragPosLS;

    mat4 buildTranslation(vec3 delta) {
        if (u_type == 1.0) {
            return mat4(
                vec4(1.0, 0.0, 0.0, 0.0),
                vec4(0.0, 1.0, 0.0, 0.0),
                vec4(0.0, 0.0, 1.0, 0.0),
                vec4(delta, 1.0)
            );
        }
        if (u_type == 2.0) {
            return mat4(
                vec4(1.0, 0.0, 0.0, 0.0),
                vec4(0.0, 1.0, 0.0, 0.0),
                vec4(0.0, 0.0, 1.0, 0.0),
                vec4(delta.x, 0.5, delta.z, 1.0)
            );
        }
        if (u_type == 3.0) {
            return mat4(
                vec4(0.6, 0.0, 0.0, 0.0),
                vec4(0.0, 0.8, 0.0, 0.0),
                vec4(0.0, 0.0, 0.6, 0.0),
                vec4(delta.x, 1.0, delta.z, 1.0)
            );
        }
        if (u_type == 4.0) {
            return mat4(
                vec4(0.6, 0.0, 0.0, 0.0),
                vec4(0.0, 0.8, 0.0, 0.0),
                vec4(0.0, 0.0, 0.6, 0.0),
                vec4(delta.x, 1.0, delta.z, 1.0)
            );
        }
        if (u_type == 5.0) {
            // because instancing array of the tracks has a lot of elements with the id -1, move those out of sight
            if (a_instancePos == -1.0) {
                return mat4(
                    vec4(2.0, 0.0, 0.0, 0.0),
                    vec4(0.0, 2.0, 0.0, 0.0),
                    vec4(0.0, 0.0, 2.0, 0.0),
                    vec4(delta.x, 400, delta.z, 1.0)
                );
            } 
            else {
                return mat4(
                    vec4(2.0, 0.0, 0.0, 0.0),
                    vec4(0.0, 2.0, 0.0, 0.0),
                    vec4(0.0, 0.0, 2.0, 0.0),
                    vec4(delta.x, 0.5, delta.z, 1.0)
                );
            }
        }
    }

    void main() {
        int id = int(a_instancePos);
        mat4 iPos = buildTranslation(u_groundArr[id]);
        vec4 worldPosition = iPos * vec4(a_pos, 1.0);
        f_worldPos = worldPosition.xyz;
        f_normal = (iPos * vec4(a_normal, 0.0)).xyz;
        f_texCoord = a_texCoord;
        f_lightDir = normalize(u_lightPosition);

        gl_Position = u_projectionMatrix * u_viewMatrix * worldPosition;
        f_fragPosLS = u_lightProjection * u_lightXform * worldPosition;
    }
`;
const trainVSSource = `#version 300 es
    precision highp float;

    uniform mat4 u_modelMatrix;
    uniform mat4 u_viewMatrix;
    uniform mat4 u_projectionMatrix;
    uniform mat4 u_lightProjection;
    uniform vec3 u_lightPosition;
    uniform mat4 u_lightXform;

    in vec3 a_pos;
    in vec3 a_normal;
    in vec2 a_texCoord;

    out vec3 f_normal;
    out vec3 f_worldPos;
    out vec2 f_texCoord;
    out vec3 f_lightDir;
    out vec4 f_fragPosLS;

    void main() {
        vec4 worldPosition = u_modelMatrix * vec4(a_pos, 1.0);
        f_worldPos = worldPosition.xyz;
        f_normal = (u_modelMatrix * vec4(a_normal, 0.0)).xyz;
        f_texCoord = a_texCoord;
        f_lightDir = normalize(u_lightPosition);

        gl_Position = u_projectionMatrix * u_viewMatrix * worldPosition;
        f_fragPosLS = u_lightProjection * u_lightXform * worldPosition;
    }
`;
const trainFSSource = `#version 300 es
    precision mediump float;

    uniform vec3 u_viewPos;
    uniform sampler2D u_texDiffuse;
    uniform sampler2D u_texShadow;

    in vec3 f_normal;
    in vec3 f_worldPos;
    in vec2 f_texCoord;
    in vec3 f_lightDir;
    in vec4 f_fragPosLS;

    out vec4 o_fragColor;

    float calculateShadow() {
        // Perspective divide.
        vec3 projCoords = f_fragPosLS.xyz / f_fragPosLS.w;

        // Transform to [0,1] range.
        projCoords = projCoords * 0.5 + 0.5;

        // No shadow for fragments outside of the light's frustum.
        if(any(lessThan(projCoords, vec3(0))) || any(greaterThan(projCoords, vec3(1)))){
            return 1.0;
        }

        float bias = 0.002;
        float closestDepth = texture(u_texShadow, projCoords.xy).r;
        return projCoords.z - bias > closestDepth  ? 0.0 : 1.0;
    }

    void main() {
        vec3 texDiffuse = texture(u_texDiffuse, f_texCoord).rgb;
        vec3 normal = normalize(f_normal);
        vec3 viewDirection = normalize(u_viewPos - f_worldPos);
        vec3 halfWay = normalize(viewDirection + f_lightDir);

        vec3 ambient = 0.4 * texDiffuse;
        float diffuseIntensity = max(0.0, dot(normal, f_lightDir)) * 1.0;
        vec3 diffuse = diffuseIntensity * texDiffuse;
        float specular = pow(max(0.0, dot(normal, halfWay)), 64.0) * 1.0;

        // shadow
        float shadow = calculateShadow();

        // color
        vec3 endColor = vec3(ambient + shadow * (diffuse + specular));
        o_fragColor = vec4(endColor, 1.0);
    }
`;

// shadow shaders ////////////////////////////////////////////
const shadowVSSource = `#version 300 es
    precision highp float;

    uniform mat4 u_modelMatrix;
    uniform mat4 u_lightXform;
    uniform mat4 u_lightProjection;

    in vec3 a_pos;

    void main()
    {
        gl_Position = u_lightProjection * u_lightXform * u_modelMatrix * vec4(a_pos, 1.0);
    }
`;
const shadowInstanceVSSource = `#version 300 es
    precision highp float;

    uniform mat4 u_lightXform;
    uniform mat4 u_lightProjection;
    uniform vec3 u_groundArr[36];
    // type of building that is being created 1=ground, 2=tree, 3=station, 4=fueltank, 5=track
    uniform float u_type;

    in float a_instancePos;
    in vec3 a_pos;

    mat4 buildTranslation(vec3 delta) {
        const float PI_2 = 1.57079632679489661923;
        if (u_type == 1.0) {
            return mat4(
                vec4(1.0, 0.0, 0.0, 0.0),
                vec4(0.0, 1.0, 0.0, 0.0),
                vec4(0.0, 0.0, 1.0, 0.0),
                vec4(delta, 1.0)
            );
        }
        if (u_type == 2.0) {
            return mat4(
                vec4(1.0, 0.0, 0.0, 0.0),
                vec4(0.0, 1.0, 0.0, 0.0),
                vec4(0.0, 0.0, 1.0, 0.0),
                vec4(delta.x, 0.5, delta.z, 1.0)
            );
        }
        if (u_type == 3.0) {
            return mat4(
                vec4(0.6, 0.0, 0.0, 0.0),
                vec4(0.0, 0.8, 0.0, 0.0),
                vec4(0.0, 0.0, 0.6, 0.0),
                vec4(delta.x, 1.0, delta.z, 1.0)
            );
        }
        if (u_type == 4.0) {
            return mat4(
                vec4(0.6, 0.0, 0.0, 0.0),
                vec4(0.0, 0.8, 0.0, 0.0),
                vec4(0.0, 0.0, 0.6, 0.0),
                vec4(delta.x, 1.0, delta.z, 1.0)
            );
        }
        if (u_type == 5.0) {
            // because instancing array of the tracks has a lot of elements with the id -1, move those out of sight
            if (a_instancePos == -1.0) {
                return mat4(
                    vec4(2.0, 0.0, 0.0, 0.0),
                    vec4(0.0, 2.0, 0.0, 0.0),
                    vec4(0.0, 0.0, 2.0, 0.0),
                    vec4(delta.x, 400, delta.z, 1.0)
                );
            } 
            else {
                return mat4(
                    vec4(2.0, 0.0, 0.0, 0.0),
                    vec4(0.0, 2.0, 0.0, 0.0),
                    vec4(0.0, 0.0, 2.0, 0.0),
                    vec4(delta.x, 0.5, delta.z, 1.0)
                );
            }
        }
    }


    void main()
    {
        int id = int(a_instancePos);
        mat4 iPos = buildTranslation(u_groundArr[id]);
        gl_Position = u_lightProjection * u_lightXform * iPos * vec4(a_pos, 1.0);
    }
`;
const shadowFSSource = `#version 300 es
    precision mediump float;

    void main() {}
`;

// post-game screen shaders ////////////////////////////////////////////
const postVSSource = `#version 300 es
    precision highp float;

    in vec2 a_pos;
    in vec2 a_texCoord;

    out vec2 f_texCoord;

    void main()
    {
        f_texCoord = a_texCoord;
        gl_Position = vec4(a_pos, 0.0, 1.0);
    }
`;
const postFSSource = `#version 300 es
    precision mediump float;

    uniform sampler2D u_texture;
    uniform sampler2D u_textLayer;
    uniform vec3 u_color;

    in vec2 f_texCoord;

    out vec4 o_fragColor;

    // create gaussian blur
    vec3 gaussian(in sampler2D tex) {
        vec2 res = vec2(800, 800);
        float Pi = 6.28318530718; // Pi*2
    
        // GAUSSIAN BLUR SETTINGS {{{
        float Directions = 16.0; // BLUR DIRECTIONS (Default 16.0 - More is better but slower)
        float Quality = 3.0; // BLUR QUALITY (Default 4.0 - More is better but slower)
        float Size = 8.0; // BLUR SIZE (Radius)
        // GAUSSIAN BLUR SETTINGS }}}
    
        vec2 Radius = Size/res.xy;
        
        // Normalized pixel coordinates (from 0 to 1)
        vec2 uv = gl_FragCoord.xy/res.xy;

        // Pixel colour
        vec4 Color = texture(tex, uv);
        
        // Blur calculations
        for (float d=0.0; d<Pi; d+=Pi/Directions)
        {
            for (float i=1.0/Quality; i<=1.001; i+=1.0/Quality)
            {
                Color += texture(tex, uv+vec2(cos(d),sin(d))*Radius*i);		
            }
        }
        Color /= Quality * Directions + 1.0;
        return Color.xyz;
    }

    void main() {
        vec3 color = gaussian(u_texture);
        float factor = texture(u_textLayer, f_texCoord).g;
        // u_color is red if game failed or green if game won
        color = factor * color * u_color;
        o_fragColor = vec4(color, 1.0);
    }
`;