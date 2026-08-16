import type { RoomInstance } from '../types';
import { createMockRoom } from '../mock-room';

export const room: RoomInstance = createMockRoom('Boids Flocking Simulation', '#00F0FF');
export default room;
