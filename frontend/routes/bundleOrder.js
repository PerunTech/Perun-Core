/**
 * Sorts bundles by their dependencies to ensure correct loading order.
 * @param {Array} bundles - The list of plugin bundles to sort.
 * @returns {Array} - The sorted list of bundles.
 */
export function sortBundlesByDependencies(bundles) {
    const bundleMap = new Map();
    const sorted = [];
    const visited = new Set();
    const visiting = new Set();

    bundles.forEach(bundle => {
        bundleMap.set(bundle.id, bundle);
    });

    /**
     * Recursively visits each bundle and its dependencies.
     * @param {Object} bundle - The bundle to visit.
     */
    const visit = (bundle) => {
        if (!bundle || visited.has(bundle.id)) return;
        if (visiting.has(bundle.id)) throw new Error(`Circular dependency detected: ${bundle.id}`);

        visiting.add(bundle.id);

        const dependencies = JSON.parse(bundle.deps || '[]');
        dependencies.forEach(dep => visit(bundleMap.get(dep)));

        visiting.delete(bundle.id);
        visited.add(bundle.id);
        sorted.push(bundle);
    };

    bundles.forEach(bundle => visit(bundle));

    return sorted;
}
