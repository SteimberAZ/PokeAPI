# 🎮 PokéBattle Simulator - Cliente/Servidor (Node.js + Express + PokéAPI)

Proyecto universitario para simular batallas Pokémon utilizando arquitectura **Cliente-Servidor**.
El backend (**Node.js con Express**) es el responsable absoluto de conectarse con la **PokéAPI** y procesar todas las reglas matemáticas y de efectividad del combate, entregando al frontend una respuesta lista para ser renderizada.

---

## 📂 1. Estructura de Carpetas del Proyecto

```text
Tarea-Arc-9/
├── package.json              # Configuración y dependencias de Node.js (express, cors)
├── server.js                 # Servidor backend en Express (Consume los 5 endpoints de PokéAPI)
└── public/                   # Frontend estático (Interfaz del cliente)
    ├── index.html            # Interfaz semántica con formulario, tarjetas y <progress>
    ├── styles.css            # Diseño premium (Glassmorphism, Dark Mode y animaciones WOW)
    └── script.js             # Lógica del cliente para peticiones POST al servidor y actualización del DOM
```

---

## 🚀 2. Instrucciones para Ejecutar el Proyecto

1. **Abre tu terminal en la carpeta del proyecto**:
   ```bash
   cd Tarea-Arc-9
   ```

2. **Instala las dependencias**:
   ```bash
   npm install
   ```

3. **Inicia el servidor Node.js**:
   ```bash
   npm start
   ```

4. **Abre la aplicación en tu navegador**:
   Entra a [http://localhost:3000](http://localhost:3000)

---

## 🎯 3. Guía Pedagógica para la Defensa en Video

Para defender este proyecto y explicar con autoridad la lógica arquitectónica y la integración de la **PokéAPI**, apóyate en los siguientes **5 endpoints** que el servidor consume:

### 1️⃣ `/api/v2/pokemon/{name}`
- **¿Qué hace?**: Obtiene las estadísticas base del Pokémon, sus tipos oficiales (`fire`, `water`, etc.) y las URL de sus sprites animados o estáticos de alta resolución.
- **En nuestro servidor (`server.js`)**: Extraemos el valor base de `hp` (Puntos de Vida) y lo duplicamos para que las batallas sean más extensas, así como sus tipos para la lógica de combate.

### 2️⃣ `/api/v2/pokemon-species/{name}`
- **¿Qué hace?**: Provee metadatos biológicos y descriptivos del Pokémon en múltiples idiomas.
- **En nuestro servidor (`server.js`)**: Buscamos la entrada en **español** dentro de `flavor_text_entries` y la categoría de especie en `genera` (ej. *"Pokémon Llama"*) para presentar una tarjeta educativa en el frontend.

### 3️⃣ `/api/v2/move/{name}`
- **¿Qué hace?**: Consulta las propiedades técnicas de un movimiento de ataque: potencia base (`power`), tipo elemental (`type`) y precisión (`accuracy`).
- **En nuestro servidor (`server.js`)**: Cuando el usuario selecciona *"Atacar"*, el servidor obtiene el poder de ese ataque (ej. `flamethrower` o `thunderbolt`) y su tipo elemental.

### 4️⃣ `/api/v2/type/{name}`
- **¿Qué hace?**: Proporciona las relaciones de daño (`damage_relations`) del tipo del movimiento contra otros tipos, informando si hace daño doble (`double_damage_to`), mitad de daño (`half_damage_to`) o ningún daño (`no_damage_to`).
- **En nuestro servidor (`server.js`)**: Se cruza el tipo del movimiento con los tipos del Pokémon rival. Con esto se calcula de manera dinámica si el ataque es *"¡Súper Efectivo! x2"*, *"No muy efectivo... x0.5"* o *"Normal x1.0"*, logrando un combate matemáticamente auténtico.

### 5️⃣ `/api/v2/item/{name}`
- **¿Qué hace?**: Retorna las características y categoría de un objeto u poción de curación.
- **En nuestro servidor (`server.js`)**: Cuando el usuario selecciona *"Curar"*, el servidor consulta la poción indicada (`potion`, `super-potion`, `hyper-potion`, `max-potion`) y suma vida al Pokémon sin exceder su `maxHp`.

---

## 🛡️ 4. Manejo de Errores (Resiliencia ante el 404)

- Si un estudiante o usuario final escribe el nombre de un Pokémon, movimiento o poción que **no existe**, la **PokéAPI responde con código HTTP 404**.
- El bloque `try/catch` y nuestra función `fetchPokeApi` en `server.js` interceptan el error 404 y lo transforman en una respuesta JSON clara:
  ```json
  {
    "success": false,
    "error": "El Pokémon 'xyz' no existe en el mundo Pokémon.",
    "type": "NOT_FOUND"
  }
  ```
- El frontend captura este mensaje y lo muestra en un banner visual animado sin romper el diseño HTML ni requerir recargar la página.
