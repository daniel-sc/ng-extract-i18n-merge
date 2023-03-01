export class LexDist {
    constructor(private dist: number[]) {
    }

    isNegative(): boolean {
        return (this.dist.find(d => d !== 0) ?? 0) < 0;
    }

    smallerThan(other: LexDist): boolean {
        let firstSignThis = 0;
        let firstSignOther = 0;
        for (let i = 0; i < Math.max(this.dist.length, other.dist.length); i++) {
            if (firstSignThis === 0) {
                firstSignThis = Math.sign(this.dist[i] ?? 0);
            }
            if (firstSignOther === 0) {
                firstSignOther = Math.sign(other.dist[i] ?? 0);
            }
            const thisDistI = firstSignThis ? firstSignThis * (this.dist[i] ?? 0) : (this.dist[i] ?? 0);
            const otherDistI = firstSignOther ? firstSignOther * (other.dist[i] ?? 0) : (other.dist[i] ?? 0);
            if (thisDistI < otherDistI) {
                return true;
            } else if (thisDistI > otherDistI) {
                return false;
            }
        }
        return false;
    }

    /**
     * "b - a"
     */
    static fromDifference(a: string, b: string): LexDist {
        const dist = [];
        for (let i = 0; i < a.length || i < b.length; i++) {
            dist.push((b.charCodeAt(i) || 0) - (a.charCodeAt(i) || 0));
        }
        return new LexDist(dist);
    }

    normalize(): LexDist {
        const dist = [...this.dist];
        while (dist.length > 0 && dist[dist.length - 1] === 0) {
            dist.pop();
        }
        return new LexDist(dist);
    }
}


const DIST_MAX = new LexDist([Number.MAX_SAFE_INTEGER]);

export function findLexClosestIndex<T>(id: string, units: T[], mapping: (unit: T) => string): [index: number, before: boolean] {
    // defaults work with empty list:
    let index = 0;
    let minDistance = DIST_MAX;
    for (let i = 0; i < units.length; i++) {
        const idNormalized = id.toLowerCase();
        const distance = LexDist.fromDifference(idNormalized, mapping(units[i]).toLowerCase());
        if (distance.smallerThan(minDistance)) {
            minDistance = distance;
            index = i;
        }
    }
    return [index, !minDistance.isNegative()];
}
