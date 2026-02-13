import numpy as np

class CrowdFlowEngine:
    def __init__(self):
        self.flow_history = []
        self.smoothing_window = 5

    def calculate_flows(self, zones_data, hour):
        """
        Calculates flows between zones based on density differences.
        zones_data: dict of {zone_id: {current, capacity, name, ...}}
        hour: current hour (0-23)
        """
        flows = []
        zone_ids = list(zones_data.keys())
        
        # Calculate densities
        densities = {}
        for zid in zone_ids:
            # We use est_people for a more "human" calculation
            z = zones_data[zid]
            densities[zid] = z['current'] / max(z['capacity'], 1)

        # Time-based multiplier for flow intensity
        time_factor = 1.0
        if 12 <= hour <= 14:
            time_factor = 1.5  # Peak hours - stronger flows
        elif hour >= 20 or hour < 7:
            time_factor = 0.3  # Night - very low movement

        for src_id in zone_ids:
            src_zone = zones_data[src_id]
            src_density = densities[src_id]
            src_people = src_zone['est_people']
            
            # 1. Calculate flow scores for all possible destinations
            flow_scores = {}
            total_score = 0
            
            for dst_id in zone_ids:
                if src_id == dst_id:
                    continue
                
                dst_density = densities[dst_id]
                # People move from high density to low density
                # flow_score = max(0, src_density - dst_density)
                # But we also add a "proximity" factor or just keep it simple as requested
                score = max(0, src_density - dst_density)
                
                if score > 0:
                    flow_scores[dst_id] = score
                    total_score += score
            
            # 2. Normalize and calculate expected flows
            if total_score > 0:
                for dst_id, score in flow_scores.items():
                    prob = score / total_score
                    
                    # Expected flow calculation
                    # We assume a small % of people in a zone are "mobile" at any time
                    mobility_rate = 0.05 * time_factor 
                    people_moving = int(src_people * prob * mobility_rate)
                    
                    if people_moving >= 1: 
                        intensity = round(min(score * 2 * time_factor, 1.0), 2)
                        flows.append({
                            "from": src_id,
                            "from_name": src_zone['name'],
                            "to": dst_id,
                            "to_name": zones_data[dst_id]['name'],
                            "volume": "High" if intensity > 0.7 else "Medium" if intensity > 0.3 else "Low", 
                            "intensity": intensity
                        })

        # 3. Smoothing (Moving Average)
        self.flow_history.append(flows)
        if len(self.flow_history) > self.smoothing_window:
            self.flow_history.pop(0)
            
        return self._get_smoothed_flows()

    def _get_smoothed_flows(self):
        if not self.flow_history:
            return []
            
        # For a simplified hackathon version, we just return the latest or average
        # Let's return the latest but wecould average intensity
        return self.flow_history[-1]

# Singleton instance
flow_engine = CrowdFlowEngine()
