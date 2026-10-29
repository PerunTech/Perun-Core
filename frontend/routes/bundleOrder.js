/**
 * Sorts bundles by their dependencies to ensure correct loading order.
 * @param {Array} bundles - The list of plugin bundles to sort.
 * @returns {Array} - The sorted list, without the bundles whose dependencies are not in it.
 */
export function sortBundlesByDependencies(bundles) {
    const bundleMap = new Map();
    const sorted = [];
    const visited = new Set();
    const visiting = new Set();
    const unmet = new Set();

    bundles.forEach(bundle => {
        bundleMap.set(bundle.id, bundle);
    });

    /**
     * Recursively visits each bundle and its dependencies.
     * @param {Object} bundle - The bundle to visit.
     */
    const visit = (bundle) => {
        if (visited.has(bundle.id) || unmet.has(bundle.id)) return;
        if (visiting.has(bundle.id)) throw new Error(`Circular dependency detected: ${bundle.id}`);

        visiting.add(bundle.id);

        // perun-core is the shell itself, there whether the list names it or not, as in ModuleMenu.
        const dependencies = JSON.parse(bundle.deps || '[]').filter(dep => dep !== 'perun-core');
        dependencies.forEach(dep => bundleMap.has(dep) && visit(bundleMap.get(dep)));

        visiting.delete(bundle.id);

        const missing = dependencies.find(dep => !bundleMap.has(dep) || unmet.has(dep));
        if (missing) {
            unmet.add(bundle.id);
            console.warn(`Skipping plugin ${bundle.id}: its dependency ${missing} is not available.`);
            return;
        }

        visited.add(bundle.id);
        sorted.push(bundle);
    };

    bundles.forEach(bundle => visit(bundle));

    return sorted;
}
