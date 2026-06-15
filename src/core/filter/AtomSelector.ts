import type { Atom, Molecule, HighlightConfig } from '../../types';
import { FUNCTIONAL_GROUPS } from '../../types';
import { useMoleculeStore } from '../../store/useMoleculeStore';

export class AtomSelector {
  public static getAtomsByElement(molecule: Molecule, element: string): Atom[] {
    return molecule.atoms.filter((atom) => atom.element === element);
  }

  public static getAtomsByElements(molecule: Molecule, elements: string[]): Atom[] {
    return molecule.atoms.filter((atom) => elements.includes(atom.element));
  }

  public static getAtomsByIds(molecule: Molecule, atomIds: number[]): Atom[] {
    return molecule.atoms.filter((atom) => atomIds.includes(atom.id));
  }

  public static getAtomsByFragment(molecule: Molecule, fragmentId: string): Atom[] {
    const fragment = molecule.fragments.find((f) => f.id === fragmentId);
    if (!fragment) return [];
    return molecule.atoms.filter((atom) => fragment.atomIds.includes(atom.id));
  }

  public static detectFunctionalGroup(atoms: Atom[], groupAtoms: string[]): number[] {
    const matchedIds: number[] = [];
    const groupSet = [...groupAtoms].sort();

    for (let i = 0; i < atoms.length; i++) {
      const window = atoms.slice(i, i + groupAtoms.length);
      if (window.length < groupAtoms.length) break;

      const windowElements = window.map((a) => a.element).sort();
      if (JSON.stringify(windowElements) === JSON.stringify(groupSet)) {
        matchedIds.push(...window.map((a) => a.id));
      }
    }

    return matchedIds;
  }

  public static highlightByElement(element: string, add: boolean = true): void {
    const { highlightConfig, updateHighlightConfig } = useMoleculeStore.getState();
    let selectedElements: string[];

    if (add) {
      selectedElements = highlightConfig.selectedElements.includes(element)
        ? highlightConfig.selectedElements.filter((e) => e !== element)
        : [...highlightConfig.selectedElements, element];
    } else {
      selectedElements = [element];
    }

    updateHighlightConfig({ selectedElements });
  }

  public static highlightByGroup(groupName: string): void {
    const groupAtoms = FUNCTIONAL_GROUPS[groupName];
    if (!groupAtoms) return;

    const { molecules, activeMoleculeId, updateHighlightConfig, highlightConfig } =
      useMoleculeStore.getState();
    const molecule = molecules.find((m) => m.id === activeMoleculeId);
    if (!molecule) return;

    const matchedAtomIds = this.detectFunctionalGroup(molecule.atoms, groupAtoms);
    const selectedGroups = highlightConfig.selectedGroups.includes(groupName)
      ? highlightConfig.selectedGroups.filter((g) => g !== groupName)
      : [...highlightConfig.selectedGroups, groupName];

    let selectedAtomIds = [...highlightConfig.selectedAtomIds];
    if (highlightConfig.selectedGroups.includes(groupName)) {
      selectedAtomIds = selectedAtomIds.filter((id) => !matchedAtomIds.includes(id));
    } else {
      selectedAtomIds = [...new Set([...selectedAtomIds, ...matchedAtomIds])];
    }

    updateHighlightConfig({ selectedGroups, selectedAtomIds });
  }

  public static clearHighlight(): void {
    const { updateHighlightConfig } = useMoleculeStore.getState();
    updateHighlightConfig({
      selectedAtomIds: [],
      selectedElements: [],
      selectedGroups: [],
    });
  }

  public static getHighlightedAtoms(molecule: Molecule, config: HighlightConfig): Atom[] {
    if (!config.enabled) return [];

    let highlighted: Atom[] = [];

    if (config.selectedAtomIds.length > 0) {
      highlighted = this.getAtomsByIds(molecule, config.selectedAtomIds);
    }

    if (config.selectedElements.length > 0) {
      const byElement = this.getAtomsByElements(molecule, config.selectedElements);
      highlighted = [...new Set([...highlighted, ...byElement])];
    }

    return highlighted;
  }

  public static isAtomHighlighted(atom: Atom, config: HighlightConfig): boolean {
    if (!config.enabled) return false;

    if (config.selectedAtomIds.includes(atom.id)) return true;
    if (config.selectedElements.includes(atom.element)) return true;

    return false;
  }

  public static getVisibleAtoms(molecule: Molecule): Atom[] {
    return molecule.atoms.filter((atom) => atom.visible !== false);
  }

  public static getElementCounts(molecule: Molecule): Record<string, number> {
    const counts: Record<string, number> = {};
    molecule.atoms.forEach((atom) => {
      counts[atom.element] = (counts[atom.element] || 0) + 1;
    });
    return counts;
  }

  public static getDistinctElements(molecule: Molecule): string[] {
    return [...new Set(molecule.atoms.map((atom) => atom.element))].sort();
  }
}
