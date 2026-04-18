/**
 * A simple Priority Queue for Dijkstra's algorithm.
 * Uses an array and sorts it. For production, a Min-Heap is more efficient,
 * but for a small dynamic front-end grid, this works perfectly.
 */
class PriorityQueue {
  constructor() {
    this.elements = [];
  }

  enqueue(node, priority) {
    this.elements.push({ node, priority });
    this.elements.sort((a, b) => a.priority - b.priority);
  }

  dequeue() {
    return this.elements.shift().node;
  }

  isEmpty() {
    return this.elements.length === 0;
  }
}

/**
 * Calculates straight-line distance between two coordinates
 */
const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

/**
 * Procedurally generates a graph resembling a city grid between Start and Target.
 * Then utilizes Dijkstra to find the absolute shortest edge-path to the destination.
 */
export const calculateDijkstraPath = (startLoc, endLoc) => {
  if (!startLoc || !endLoc) return [];
  
  // 1. Generate grid boundaries
  const margin = 0.005; // ~500m margin
  const minLat = Math.min(startLoc.lat, endLoc.lat) - margin;
  const maxLat = Math.max(startLoc.lat, endLoc.lat) + margin;
  const minLng = Math.min(startLoc.lng, endLoc.lng) - margin;
  const maxLng = Math.max(startLoc.lng, endLoc.lng) + margin;

  // 2. We divide the bounding box into a 6x6 intersection grid
  const steps = 6;
  const latStep = (maxLat - minLat) / steps;
  const lngStep = (maxLng - minLng) / steps;

  const nodes = [];
  
  // Ensure strict start and end nodes are in the graph to avoid rounding misses
  nodes.push({ id: 'START', lat: startLoc.lat, lng: startLoc.lng });
  nodes.push({ id: 'END', lat: endLoc.lat, lng: endLoc.lng });

  // Generate random city intersections
  for (let i = 0; i <= steps; i++) {
    for (let j = 0; j <= steps; j++) {
      // Intentionally introduce map scatter (fake winding physical roads)
      const latOffset = (Math.random() - 0.5) * (latStep * 0.4);
      const lngOffset = (Math.random() - 0.5) * (lngStep * 0.4);
      
      nodes.push({ 
        id: `node_${i}_${j}`, 
        lat: minLat + (i * latStep) + latOffset, 
        lng: minLng + (j * lngStep) + lngOffset 
      });
    }
  }

  // 3. Build Adjacency List (Connect each node to its closest 4 neighbors like city blocks)
  const graph = {};
  nodes.forEach(n => graph[n.id] = {});

  nodes.forEach(nodeA => {
    // Sort all other nodes by distance
    const neighbors = [...nodes]
      .filter(n => n.id !== nodeA.id)
      .map(n => ({ id: n.id, dist: getDistance(nodeA.lat, nodeA.lng, n.lat, n.lng) }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 4); // Take top 4 closest nodes to act as intersections

    neighbors.forEach(neighbor => {
      // Undirected graph equivalent
      graph[nodeA.id][neighbor.id] = neighbor.dist;
      graph[neighbor.id][nodeA.id] = neighbor.dist; 
    });
  });

  // 4. Standard Dijkstra Priority Queue execution
  const distances = {};
  const previous = {};
  const pq = new PriorityQueue();

  nodes.forEach(n => {
    distances[n.id] = Infinity;
    previous[n.id] = null;
  });

  distances['START'] = 0;
  pq.enqueue('START', 0);

  let current = null;

  while (!pq.isEmpty()) {
    current = pq.dequeue();

    if (current === 'END') {
      break; // Shortest path reached
    }

    if (!graph[current]) continue;

    for (const neighbor in graph[current]) {
      const dist = graph[current][neighbor];
      const alt = distances[current] + dist;
      
      if (alt < distances[neighbor]) {
        distances[neighbor] = alt;
        previous[neighbor] = current;
        pq.enqueue(neighbor, alt);
      }
    }
  }

  // 5. Backtrack shortest path tree to construct route coordinate array
  const path = [];
  let backtrack = 'END';
  
  if (previous[backtrack] || backtrack === 'START') {
    while (backtrack) {
      const nodeObj = nodes.find(n => n.id === backtrack);
      if (nodeObj) path.unshift({ lat: nodeObj.lat, lng: nodeObj.lng });
      backtrack = previous[backtrack];
    }
  }

  return path; // Array of waypoints for Leaflet `<Polyline>`
};
